/**
 * Data loader — reads the questions + recordings for both corpora at
 * build time and exposes them as one flat list. The whole site is
 * static; no API routes, no API keys, no Vercel functions.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type RetrievalChunk = {
  chunk: {
    chunkId: string;
    document: string;
    page: number;
    text: string;
  };
  score?: number;
};

export type AgentAnswer = {
  question: string;
  answer: string;
  claimedCitation: { document: string; page: number } | null;
  refused: boolean;
  retrievedChunks: RetrievalChunk[];
  costUSD: number;
  latencyMs: number;
  model: string;
  rungName?: string;
};

export type JudgeResult = {
  verdict: string;
  rationale: string;
  judgeModel: string;
  costUSD: number;
  latencyMs: number;
};

export type Pair = {
  id: string;
  inCorpus: boolean;
  audience?: string;
  question: string;
  expectedAnswer: string;
  citation?: { document: string; page: number };
  corpus: "medicare" | "osha";
};

export type Recording = {
  pairId: string;
  agent: AgentAnswer;
  judge: JudgeResult | null;
};

export type EvalRow = {
  pair: Pair;
  recording: Recording;
};

function readJsonl<T>(rel: string): T[] {
  const path = resolve(process.cwd(), "..", rel);
  const raw = readFileSync(path, "utf8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

let cache: EvalRow[] | null = null;

export function loadAllRows(): EvalRow[] {
  if (cache) return cache;

  const medicareQs = readJsonl<Omit<Pair, "corpus">>("eval/questions.jsonl").map(
    (p) => ({ ...p, corpus: "medicare" as const }),
  );
  const oshaQs = readJsonl<Omit<Pair, "corpus">>("eval/questions.osha.jsonl").map(
    (p) => ({ ...p, corpus: "osha" as const }),
  );
  const medicareRecs = readJsonl<Recording>("eval/recordings/medicare.jsonl");
  const oshaRecs = readJsonl<Recording>("eval/recordings/osha.jsonl");

  const allPairs = [...medicareQs, ...oshaQs];
  const recById = new Map<string, Recording>();
  for (const r of [...medicareRecs, ...oshaRecs]) recById.set(r.pairId, r);

  const rows: EvalRow[] = [];
  for (const p of allPairs) {
    const r = recById.get(p.id);
    if (!r) continue;
    rows.push({ pair: p, recording: r });
  }

  cache = rows;
  return rows;
}

export type Aggregates = {
  total: number;
  medicare: number;
  osha: number;
  inCorpus: number;
  outOfCorpus: number;
  faithful: number;
  unsupported: number;
  refusedCorrectly: number;
  totalCostUSD: number;
};

export function aggregates(rows: EvalRow[]): Aggregates {
  let medicare = 0;
  let osha = 0;
  let inCorpus = 0;
  let outOfCorpus = 0;
  let faithful = 0;
  let unsupported = 0;
  let refusedCorrectly = 0;
  let totalCost = 0;

  for (const row of rows) {
    if (row.pair.corpus === "medicare") medicare++;
    else osha++;
    if (row.pair.inCorpus) inCorpus++;
    else outOfCorpus++;

    if (row.recording.judge?.verdict === "faithful") faithful++;
    else if (row.recording.judge?.verdict === "unsupported") unsupported++;

    // Out-of-corpus questions pass when the agent refused.
    if (!row.pair.inCorpus && row.recording.agent.refused) refusedCorrectly++;

    totalCost += row.recording.agent.costUSD + (row.recording.judge?.costUSD ?? 0);
  }

  return {
    total: rows.length,
    medicare,
    osha,
    inCorpus,
    outOfCorpus,
    faithful,
    unsupported,
    refusedCorrectly,
    totalCostUSD: totalCost,
  };
}
