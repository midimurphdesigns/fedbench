/**
 * Grounded-Q&A agent.
 *
 * Given a question, retrieves the top-K most relevant chunks from the
 * BM25 index, prompts Claude with the chunks as evidence + strict
 * citation/refusal rules, and returns a structured answer with the
 * agent's own citation claim.
 *
 * The agent is provider-agnostic at the call site (the `client()` factory
 * could be swapped for an OpenAI or OpenRouter client), but defaults to
 * Anthropic Sonnet 4.6. The judge in src/eval/judge.ts deliberately uses
 * a STRONGER model (Opus 4.7) to score the agent — never the same model.
 */

import Anthropic from "@anthropic-ai/sdk";
import { search, type RetrievalResult } from "../retrieval/bm25.ts";
import { callLadder } from "./fallback-ladder.ts";
import { buildSystemPrompt, MEDICARE_DOMAIN, type DomainConfig } from "./domain.ts";

export type AgentAnswer = {
  question: string;
  answer: string;
  claimedCitation: { document: string; page: number } | null;
  refused: boolean;
  retrievedChunks: RetrievalResult[];
  costUSD: number;
  latencyMs: number;
  model: string;
  // Provenance for the fallback ladder. `rungName` records which rung
  // produced this answer (primary, fallback, ...). `ladderAttempts`
  // captures any earlier rungs that failed before this one succeeded.
  rungName: string;
  ladderAttempts: { rung: string; error: string }[];
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  _client = new Anthropic({ apiKey });
  return _client;
}

const REFUSAL_PATTERNS = [
  /\bI don'?t see that in the document\b/i,
  /\bnot in the document\b/i,
  /\bnot in the evidence\b/i,
  /\bI don'?t have (that )?information\b/i,
];

export function detectRefusal(text: string): boolean {
  return REFUSAL_PATTERNS.some((p) => p.test(text));
}

export function parseCitation(text: string): { document: string; page: number } | null {
  // Match [cite: <doc>, page <N>]  — tolerant of spacing, capitalization,
  // and the dash variants the model occasionally emits.
  const re = /\[cite:\s*([a-z0-9_\-]+)\s*,\s*page\s+(\d+)\s*\]/i;
  const match = text.match(re);
  if (!match) return null;
  return { document: match[1] ?? "", page: Number.parseInt(match[2] ?? "0", 10) };
}

function formatEvidence(results: RetrievalResult[]): string {
  return results
    .map((r) => {
      const header = `[document: ${r.chunk.document}, page: ${r.chunk.page}, retrieval-score: ${r.score.toFixed(2)}]`;
      return `${header}\n${r.chunk.text}`;
    })
    .join("\n\n---\n\n");
}

export async function answerQuestion(
  question: string,
  options: { topK?: number; domain?: DomainConfig } = {},
): Promise<AgentAnswer> {
  const topK = options.topK ?? 5;
  const domain = options.domain ?? MEDICARE_DOMAIN;
  const retrieved = search(question, topK);

  if (retrieved.length === 0) {
    // No retrieval results at all — the agent should refuse without
    // even calling the LLM. Saves a token bill on obviously-OOC queries.
    return {
      question,
      answer: "I don't see that in the document.",
      claimedCitation: null,
      refused: true,
      retrievedChunks: [],
      costUSD: 0,
      latencyMs: 0,
      model: "no-call",
      rungName: "skipped",
      ladderAttempts: [],
    };
  }

  const evidence = formatEvidence(retrieved);
  const userMessage = `EVIDENCE:\n\n${evidence}\n\n---\n\nQUESTION: ${question}`;

  const ladderResult = await callLadder({
    client: client(),
    systemPrompt: buildSystemPrompt(domain),
    userMessage,
    maxTokens: 600,
  });

  const text = ladderResult.rawResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const refused = detectRefusal(text);
  const claimedCitation = refused ? null : parseCitation(text);

  return {
    question,
    answer: text,
    claimedCitation,
    refused,
    retrievedChunks: retrieved,
    costUSD: ladderResult.costUSD,
    latencyMs: ladderResult.latencyMs,
    model: ladderResult.rawResponse.model,
    rungName: ladderResult.rung.name,
    ladderAttempts: ladderResult.attempts,
  };
}
