/**
 * Eval runner — orchestrates the layered evaluation.
 *
 *   bun run eval
 *
 * For each Q&A pair in eval/questions.jsonl:
 *   1. Layer 1: deterministic citation-existence check (no LLM, free).
 *      Validates that the ground-truth answer's load-bearing tokens
 *      actually appear on the cited page. Catches typos in the ground
 *      truth itself and corpus drift.
 *   2. Layer 2: LLM-as-judge faithfulness scoring (only on in-corpus
 *      pairs that pass Layer 1). The judge sees the cited chunk as
 *      evidence and scores the ground-truth answer for faithfulness.
 *   3. For OOC pairs: skip Layers 1 and 2; refusal-discipline is scored
 *      against the agent's response, not the ground-truth answer.
 *
 * NOTE: this runner currently scores GROUND TRUTH against the corpus
 * (sanity-checking the eval set itself). Once the agent + retrieval
 * layer is wired (steps 4-5), the runner will additionally score the
 * AGENT's outputs and report metrics: citation accuracy %, faithful %,
 * cost per pair, p50/p95 latency.
 *
 * Cost: ~$0.01 per pair at Opus pricing for Layer 2 only.
 * Layer 1 is free; OOC pairs skip Layer 2 entirely.
 */

import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { checkCitation } from "./citation-check.ts";
import { judgeAnswer, type JudgeResult } from "./judge.ts";

type EvalPair = {
  id: string;
  inCorpus: boolean;
  question: string;
  expectedAnswer: string;
  citation?: { document: string; page: number };
  draftStatus: string;
  verifiedBy?: string;
};

const ROOT = resolve(import.meta.dir, "..", "..");
const QUESTIONS_PATH = resolve(ROOT, "eval", "questions.jsonl");

function loadQuestions(): EvalPair[] {
  const raw = readFileSync(QUESTIONS_PATH, "utf8");
  const out: EvalPair[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    out.push(JSON.parse(trimmed) as EvalPair);
  }
  return out;
}

type RunRow = {
  id: string;
  inCorpus: boolean;
  citationCheck: "pass" | "fail" | "skip" | "n/a";
  citationDetail: string;
  judge?: JudgeResult;
};

function fmtUSD(n: number): string {
  return `$${n.toFixed(6)}`;
}

async function main(): Promise<void> {
  const pairs = loadQuestions();
  const eligible = pairs.filter((p) => p.draftStatus === "verified");
  if (eligible.length === 0) {
    console.error("No verified pairs in eval/questions.jsonl. Aborting.");
    process.exit(1);
  }

  console.log("─────────────────────────────────────────────────────");
  console.log(`fedbench eval — ${eligible.length} verified pairs`);
  console.log("─────────────────────────────────────────────────────");

  const rows: RunRow[] = [];
  let totalCost = 0;
  let totalLatency = 0;
  let layer2Calls = 0;

  for (const pair of eligible) {
    if (!pair.inCorpus) {
      // OOC pairs don't have a citation to check or an answer to judge
      // against the corpus — refusal-discipline scoring happens against
      // the agent's response in a later step (not yet implemented here).
      rows.push({
        id: pair.id,
        inCorpus: false,
        citationCheck: "n/a",
        citationDetail: "OOC pair; refusal-discipline scoring deferred to agent run",
      });
      continue;
    }

    if (!pair.citation) {
      rows.push({
        id: pair.id,
        inCorpus: true,
        citationCheck: "fail",
        citationDetail: "in-corpus pair has no citation",
      });
      continue;
    }

    const layer1 = checkCitation(pair.citation, pair.expectedAnswer);
    const row: RunRow = {
      id: pair.id,
      inCorpus: true,
      citationCheck: layer1.status,
      citationDetail:
        layer1.status === "pass"
          ? `${layer1.matchedTokens.length} tokens matched`
          : layer1.status === "fail"
            ? layer1.reason
            : layer1.reason,
    };

    if (layer1.status === "pass") {
      try {
        const verdict = await judgeAnswer({
          question: pair.question,
          answer: pair.expectedAnswer,
          citation: pair.citation,
        });
        row.judge = verdict;
        totalCost += verdict.costUSD;
        totalLatency += verdict.latencyMs;
        layer2Calls += 1;
      } catch (err) {
        row.citationDetail += ` | judge error: ${(err as Error).message}`;
      }
    }

    rows.push(row);
  }

  // Print report
  console.log();
  for (const row of rows) {
    const flag =
      row.citationCheck === "pass"
        ? "✓"
        : row.citationCheck === "fail"
          ? "✗"
          : row.citationCheck === "skip"
            ? "·"
            : "—";
    const judgeStr = row.judge
      ? `  judge=${row.judge.verdict.padEnd(20)} ${fmtUSD(row.judge.costUSD)}  ${row.judge.latencyMs}ms`
      : "";
    console.log(`  ${flag} ${row.id.padEnd(8)} ${row.citationDetail}${judgeStr}`);
    if (row.judge) {
      console.log(`           ${row.judge.rationale}`);
    }
  }

  // Aggregates
  console.log();
  console.log("─────────────────────────────────────────────────────");
  const inCorpusRows = rows.filter((r) => r.inCorpus);
  const oocRows = rows.filter((r) => !r.inCorpus);
  const passing = inCorpusRows.filter((r) => r.citationCheck === "pass").length;
  const failing = inCorpusRows.filter((r) => r.citationCheck === "fail").length;
  const skipped = inCorpusRows.filter((r) => r.citationCheck === "skip").length;
  const faithful = rows.filter((r) => r.judge?.verdict === "faithful").length;
  const partial = rows.filter((r) => r.judge?.verdict === "partially-faithful").length;
  const unfaithful = rows.filter((r) => r.judge?.verdict === "unfaithful").length;

  console.log(`In-corpus pairs: ${inCorpusRows.length}`);
  console.log(`  citation existence: ${passing} pass / ${failing} fail / ${skipped} skip`);
  console.log(`  judge verdict:      ${faithful} faithful / ${partial} partial / ${unfaithful} unfaithful`);
  console.log(`OOC pairs: ${oocRows.length}  (refusal scoring runs against agent output, not here)`);
  console.log();
  console.log(`Layer 2 (judge) calls: ${layer2Calls}`);
  console.log(`Layer 2 total cost:    ${fmtUSD(totalCost)}`);
  console.log(`Layer 2 total latency: ${totalLatency}ms`);
  if (layer2Calls > 0) {
    console.log(
      `Layer 2 avg per pair:  ${fmtUSD(totalCost / layer2Calls)} / ${Math.round(totalLatency / layer2Calls)}ms`,
    );
  }
  console.log("─────────────────────────────────────────────────────");

  // Pass/fail gate
  if (failing > 0 || unfaithful > 0) {
    console.error("✗ Eval failed: citation-check or judge surfaced unfaithful pairs.");
    process.exit(1);
  }
  console.log("✓ Eval passed.");
}

main().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
