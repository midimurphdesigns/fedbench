/**
 * LLM-as-judge layer for evaluation.
 *
 * Where deterministic citation-existence checks (citation-check.ts) can't
 * reach — answer faithfulness, semantic accuracy, refusal correctness on
 * borderline cases — we ask a stronger model to score the agent's output
 * against the cited evidence.
 *
 * Design principles:
 *   - The judge runs on a stronger model than the agent under test
 *     (e.g., judge: Opus, agent: Sonnet) to avoid the "model judges
 *     itself" failure mode.
 *   - The judge always sees the cited chunk as evidence; it doesn't
 *     rely on its own training-data knowledge of the policy domain.
 *   - The judge returns a categorical verdict + a one-line rationale.
 *     Free-form judge prose is harder to aggregate; categories aren't.
 *   - Cost is logged per call. ~$0.01 per pair at Opus pricing.
 */

import Anthropic from "@anthropic-ai/sdk";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { getActiveCorpusPaths } from "../corpus/paths.ts";

export type JudgeVerdict = "faithful" | "partially-faithful" | "unfaithful";

export type JudgeResult = {
  verdict: JudgeVerdict;
  rationale: string;
  judgeModel: string;
  costUSD: number;
  latencyMs: number;
};

// Active-corpus cache dir is resolved per-call via getActiveCorpusPaths()
// so the judge tracks the same corpus the eval runner activated.

// Sonnet 4.6 prices: $3 / MTok input, $15 / MTok output (as of writing).
// Claude Opus 4.7 (1M ctx): used for the judge — stronger reasoning at
// higher cost. Adjust if Anthropic publishes new rates.
const JUDGE_MODEL = "claude-opus-4-7";
const JUDGE_INPUT_USD_PER_MTOK = 15;
const JUDGE_OUTPUT_USD_PER_MTOK = 75;

const SYSTEM_PROMPT = `
You are an evaluator for a document-grounded Q&A agent. You will be given:
  - A QUESTION asked of the agent
  - The agent's ANSWER
  - The CITED CHUNK from the source document that the agent referenced

Your job: judge whether the agent's answer is faithful to the cited chunk.

Output exactly one JSON object on a single line, with these keys:
  - "verdict": one of "faithful" | "partially-faithful" | "unfaithful"
  - "rationale": a single sentence (≤140 chars) explaining the verdict

Definitions:
  - "faithful": every factual claim in the answer is supported by the cited chunk
  - "partially-faithful": the answer is mostly correct but contains at least one
    claim not supported by the chunk, OR omits a load-bearing qualifier present
    in the source (e.g., "in most cases", "if you have X coverage")
  - "unfaithful": the answer contradicts the cited chunk, OR the claim doesn't
    appear in the chunk at all

Be precise. Prefer "partially-faithful" over "faithful" when uncertain. Don't
explain your reasoning; just return the JSON.
`.trim();

function loadPageText(documentId: string, page: number): string | null {
  const path = resolve(getActiveCorpusPaths().cacheDir, `${documentId}.txt`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const sections = raw.split(/=== PAGE (\d+) ===/);
  for (let i = 1; i < sections.length; i += 2) {
    if (Number.parseInt(sections[i] ?? "", 10) === page) {
      return sections[i + 1] ?? null;
    }
  }
  return null;
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing — required for the judge layer");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export type JudgeInput = {
  question: string;
  answer: string;
  citation: { document: string; page: number };
};

export async function judgeAnswer(input: JudgeInput): Promise<JudgeResult> {
  const chunk = loadPageText(input.citation.document, input.citation.page);
  if (!chunk) {
    throw new Error(
      `cannot judge: corpus cache missing for ${input.citation.document} page ${input.citation.page}. Run: bun run corpus:fetch && bun run corpus:parse`,
    );
  }

  const userMessage = [
    `QUESTION: ${input.question}`,
    "",
    `ANSWER: ${input.answer}`,
    "",
    "CITED CHUNK (from " +
      input.citation.document +
      " page " +
      input.citation.page +
      "):",
    chunk.trim(),
  ].join("\n");

  const startedAt = Date.now();
  const response = await client().messages.create({
    model: JUDGE_MODEL,
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const latencyMs = Date.now() - startedAt;

  const inputCost = (response.usage.input_tokens / 1_000_000) * JUDGE_INPUT_USD_PER_MTOK;
  const outputCost = (response.usage.output_tokens / 1_000_000) * JUDGE_OUTPUT_USD_PER_MTOK;
  const costUSD = inputCost + outputCost;

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Tolerate the model wrapping the JSON in prose or fences.
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`judge returned non-JSON output: ${text.slice(0, 200)}`);
  }
  let parsed: { verdict?: string; rationale?: string };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(
      `judge returned malformed JSON: ${(err as Error).message}; raw: ${jsonMatch[0].slice(0, 200)}`,
    );
  }

  const verdict = parsed.verdict;
  if (
    verdict !== "faithful" &&
    verdict !== "partially-faithful" &&
    verdict !== "unfaithful"
  ) {
    throw new Error(`judge returned invalid verdict: ${String(verdict)}`);
  }

  return {
    verdict,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    judgeModel: response.model,
    costUSD,
    latencyMs,
  };
}
