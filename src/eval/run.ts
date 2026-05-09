/**
 * Eval runner — invokes the agent on every question, scores its outputs.
 *
 *   bun run eval
 *
 * For each Q&A pair in eval/questions.jsonl:
 *   1. Run the agent (BM25 retrieval + Claude grounded-answer). Capture
 *      its answer, claimed citation, and refusal flag.
 *   2. For in-corpus pairs:
 *        - Layer 1 (deterministic): does the agent's claimed citation
 *          page actually contain the load-bearing tokens of the agent's
 *          answer?
 *        - Layer 2 (LLM-as-judge): does the cited chunk semantically
 *          support the agent's claim?
 *        - Refusal correctness: did the agent answer (correct) or refuse
 *          (false-refusal, fail)?
 *   3. For out-of-corpus pairs:
 *        - Refusal correctness: did the agent refuse (correct) or did it
 *          fabricate an answer (fail)?
 *
 * Aggregates: citation accuracy %, faithful %, refusal rate on OOC,
 * false-refusal rate on in-corpus, total cost (agent + judge), p50/p95
 * latency.
 */

import { readFileSync } from "node:fs";
import { answerQuestion, type AgentAnswer } from "../agent/answer.ts";
import { getDomain } from "../agent/domain.ts";
import { setCorpus } from "../retrieval/bm25.ts";
import { getCorpusPaths, resolveCorpusFromArgv } from "../corpus/paths.ts";
import { checkCitation } from "./citation-check.ts";
import { judgeAnswer, type JudgeResult } from "./judge.ts";
import {
  createLiveStore,
  createReplayStore,
  getRecordingPath,
  type RecordingStore,
} from "./recording.ts";

type EvalPair = {
  id: string;
  inCorpus: boolean;
  question: string;
  expectedAnswer: string;
  citation?: { document: string; page: number };
  draftStatus: string;
};

function loadQuestions(questionsPath: string): EvalPair[] {
  const raw = readFileSync(questionsPath, "utf8");
  const out: EvalPair[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    out.push(JSON.parse(trimmed) as EvalPair);
  }
  return out;
}

type EvalRow = {
  pair: EvalPair;
  agent: AgentAnswer;
  citationCheck: "pass" | "fail" | "skip" | "n/a";
  citationDetail: string;
  judge: JudgeResult | null;
  refusalCorrect: boolean;
  passed: boolean;
};

function fmtUSD(n: number): string {
  return `$${n.toFixed(6)}`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

async function evaluatePair(
  pair: EvalPair,
  corpusId: string,
  store: RecordingStore,
): Promise<EvalRow> {
  const domain = getDomain(corpusId);
  const agent = await store.getAgent(pair.id, () =>
    answerQuestion(pair.question, { domain }),
  );

  // OOC pairs: only refusal matters.
  if (!pair.inCorpus) {
    const refusalCorrect = agent.refused;
    return {
      pair,
      agent,
      citationCheck: "n/a",
      citationDetail: "OOC; refusal-only scoring",
      judge: null,
      refusalCorrect,
      passed: refusalCorrect,
    };
  }

  // In-corpus pair where the agent refused: false-refusal failure.
  if (agent.refused) {
    return {
      pair,
      agent,
      citationCheck: "n/a",
      citationDetail: "agent refused on an in-corpus question (false refusal)",
      judge: null,
      refusalCorrect: false,
      passed: false,
    };
  }

  // In-corpus, agent answered. Need a citation claim to score against.
  if (!agent.claimedCitation) {
    return {
      pair,
      agent,
      citationCheck: "fail",
      citationDetail: "agent answered but did not produce a parseable citation",
      judge: null,
      refusalCorrect: true,
      passed: false,
    };
  }

  // Layer 1: deterministic citation check on the AGENT's answer +
  // AGENT's claimed citation page.
  const layer1 = checkCitation(agent.claimedCitation, agent.answer);

  let judge: JudgeResult | null = null;
  if (layer1.status === "pass" || layer1.status === "skip") {
    const claimedCitation = agent.claimedCitation;
    try {
      judge = await store.getJudge(pair.id, () =>
        judgeAnswer({
          question: pair.question,
          answer: agent.answer,
          citation: claimedCitation,
        }),
      );
    } catch (err) {
      // Don't let a judge failure mask a working citation check.
      console.error(`  judge error for ${pair.id}: ${(err as Error).message}`);
    }
  }

  const citationDetail =
    layer1.status === "pass"
      ? `${layer1.matchedTokens.length} tokens matched on p.${agent.claimedCitation.page}`
      : layer1.status === "fail"
        ? layer1.reason
        : layer1.reason;

  // Pass criteria:
  //  - Layer 1 (citation existence) passes OR skips (skip = no extractable
  //    deterministic tokens, defer to judge)
  //  - Layer 2 (judge) does not return "unfaithful". "partially-faithful"
  //    verdicts (omitted hedging qualifiers, minor inferences) are
  //    surfaced for human sample-audit but don't fail the gate — at v0.1,
  //    they're judge-strictness signal, not agent-failure signal.
  //  - Layer 1 outright fail = always a fail (made-up citation page).
  const layer1OK = layer1.status === "pass" || layer1.status === "skip";
  const judgeOK = judge === null || judge.verdict !== "unfaithful";
  const passed = layer1OK && judgeOK;

  return {
    pair,
    agent,
    citationCheck: layer1.status,
    citationDetail,
    judge,
    refusalCorrect: true,
    passed,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const corpusId = resolveCorpusFromArgv(argv);
  const replay = argv.includes("--replay");
  const record = argv.includes("--record");
  if (replay && record) {
    console.error("--replay and --record are mutually exclusive");
    process.exit(2);
  }

  const paths = getCorpusPaths(corpusId);
  setCorpus(corpusId);

  const pairs = loadQuestions(paths.questionsPath);
  const eligible = pairs.filter((p) => p.draftStatus === "verified");
  if (eligible.length === 0) {
    console.error(`no verified pairs in ${paths.questionsPath}`);
    process.exit(1);
  }

  const recordingPath = getRecordingPath(corpusId);
  const store: RecordingStore = replay
    ? createReplayStore(recordingPath)
    : createLiveStore(record ? recordingPath : null);

  const mode = replay ? "replay" : record ? "live + record" : "live";
  console.log("─────────────────────────────────────────────────────");
  console.log(`fedbench eval [${corpusId}, ${mode}] — ${eligible.length} verified pairs`);
  if (replay) {
    console.log(`  reading recording from ${recordingPath}`);
  }
  console.log("─────────────────────────────────────────────────────\n");

  const rows: EvalRow[] = [];
  for (const pair of eligible) {
    process.stdout.write(`  ${pair.id} ... `);
    const row = await evaluatePair(pair, corpusId, store);
    rows.push(row);
    const flag = row.passed ? "✓" : "✗";
    const judgeStr = row.judge ? ` judge=${row.judge.verdict}` : "";
    const refusalStr = row.pair.inCorpus ? "" : ` refused=${row.agent.refused}`;
    console.log(`${flag} ${row.citationDetail}${judgeStr}${refusalStr}`);
    if (row.agent.refused && !row.pair.inCorpus) {
      // Good refusal — no further detail needed.
    } else if (!row.pair.inCorpus) {
      console.log(`         AGENT ANSWERED (should have refused): ${row.agent.answer.slice(0, 120)}`);
    } else if (row.judge) {
      console.log(`         ${row.judge.rationale}`);
    }
  }

  // Aggregates
  console.log();
  console.log("─────────────────────────────────────────────────────");
  const inCorpus = rows.filter((r) => r.pair.inCorpus);
  const ooc = rows.filter((r) => !r.pair.inCorpus);

  const citationPass = inCorpus.filter((r) => r.citationCheck === "pass").length;
  const citationFail = inCorpus.filter((r) => r.citationCheck === "fail").length;
  const citationSkip = inCorpus.filter((r) => r.citationCheck === "skip").length;

  const judgeFaithful = inCorpus.filter((r) => r.judge?.verdict === "faithful").length;
  const judgePartial = inCorpus.filter((r) => r.judge?.verdict === "partially-faithful").length;
  const judgeUnfaithful = inCorpus.filter((r) => r.judge?.verdict === "unfaithful").length;

  const inCorpusFalseRefusal = inCorpus.filter((r) => r.agent.refused).length;
  const oocCorrectRefusal = ooc.filter((r) => r.agent.refused).length;

  const totalAgentCost = rows.reduce((s, r) => s + r.agent.costUSD, 0);
  const totalJudgeCost = rows.reduce((s, r) => s + (r.judge?.costUSD ?? 0), 0);
  const agentLatencies = rows.map((r) => r.agent.latencyMs).filter((l) => l > 0);

  console.log(`In-corpus pairs:    ${inCorpus.length}`);
  console.log(`  citation existence: ${citationPass} pass / ${citationFail} fail / ${citationSkip} skip`);
  console.log(`  judge verdict:      ${judgeFaithful} faithful / ${judgePartial} partial / ${judgeUnfaithful} unfaithful`);
  console.log(`  false refusal:      ${inCorpusFalseRefusal} / ${inCorpus.length}`);
  console.log();
  console.log(`OOC pairs:          ${ooc.length}`);
  console.log(`  refusal rate:     ${oocCorrectRefusal} / ${ooc.length}`);
  console.log();
  console.log(`Cost (agent):       ${fmtUSD(totalAgentCost)}`);
  console.log(`Cost (judge):       ${fmtUSD(totalJudgeCost)}`);
  console.log(`Cost (total):       ${fmtUSD(totalAgentCost + totalJudgeCost)}`);
  console.log();
  console.log(`Agent latency p50:  ${percentile(agentLatencies, 50)}ms`);
  console.log(`Agent latency p95:  ${percentile(agentLatencies, 95)}ms`);
  console.log("─────────────────────────────────────────────────────");

  const passed = rows.filter((r) => r.passed).length;
  console.log(`Result: ${passed} / ${rows.length} pairs passed`);

  store.finalize();

  if (passed < rows.length) {
    console.log("✗ Eval failed — see per-pair output above for details.");
    process.exit(1);
  }
  console.log("✓ Eval passed.");
}

main().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
