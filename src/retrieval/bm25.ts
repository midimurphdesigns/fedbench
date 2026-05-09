/**
 * BM25 retrieval over the chunked corpus.
 *
 * BM25 is the industry-standard keyword-relevance ranking from the
 * mid-1990s. It still beats most modern dense-vector retrievers on
 * short, factual, domain-specific queries because the dominant signal
 * in those queries IS the literal vocabulary ("Part B premium",
 * "10 days", "8-month period"). Embedding similarity wins on
 * paraphrase-heavy or cross-lingual workloads; benefits-policy queries
 * are neither.
 *
 * Self-contained, zero dependencies. Builds an in-memory index from
 * .corpus-cache/chunks.jsonl on first use; subsequent queries are
 * served from memory in microseconds.
 *
 * Tuning:
 *   k1 = 1.5   (term-frequency saturation)
 *   b  = 0.75  (length normalization)
 * Standard Robertson values. Adjustable if retrieval quality lags.
 */

import { existsSync, readFileSync } from "node:fs";
import type { Chunk } from "../corpus/chunk.ts";
import { getCorpusPaths, DEFAULT_CORPUS, activateCorpus } from "../corpus/paths.ts";
import type { Retriever } from "./index.ts";

let _chunksPath = getCorpusPaths(DEFAULT_CORPUS).chunksPath;

/**
 * Switch the active corpus for retrieval AND for the per-process active-
 * corpus state that the citation-check + judge layers also read from.
 * Resets the cached BM25 index so the next search() call reads from the
 * new corpus's chunks.jsonl. Idempotent — calling with the current
 * corpus is a no-op.
 */
export function setCorpus(id: string): void {
  activateCorpus(id);
  const next = getCorpusPaths(id).chunksPath;
  if (next === _chunksPath) return;
  _chunksPath = next;
  _index = null;
}

const K1 = 1.5;
const B = 0.75;

// Minimal English stopword list. BM25 is robust to stopwords (their IDF
// approaches zero anyway), but stripping them keeps the term-frequency
// vectors smaller and accelerates the inner loop on a small corpus.
const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "of", "to", "in", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "for", "on", "at", "by", "with", "from", "as", "this", "that", "these",
  "those", "it", "its", "he", "she", "his", "her", "they", "them", "their",
  "you", "your", "i", "my", "me", "we", "us", "our", "but", "if", "then",
  "than", "so", "not", "no", "yes", "can", "will", "would", "could",
  "should", "may", "might", "must", "shall",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9\s$%.\-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

type IndexedChunk = {
  chunk: Chunk;
  termFreq: Map<string, number>;
  length: number;
};

export type RetrievalResult = {
  chunk: Chunk;
  score: number;
};

/**
 * Concrete BM25 retriever conforming to the shared Retriever interface.
 * Identical behavior to the bare `search()` function below — wrapping
 * exists so the eval can hold a single Retriever reference and compare
 * implementations without branching on a string.
 */
export const bm25Retriever: Retriever = {
  name: "bm25",
  search: (query: string, topK?: number) => search(query, topK),
};

let _index: {
  chunks: IndexedChunk[];
  docFreq: Map<string, number>;
  avgLength: number;
  totalDocs: number;
} | null = null;

function loadChunks(): Chunk[] {
  if (!existsSync(_chunksPath)) {
    throw new Error(
      `no chunks at ${_chunksPath}. Run: bun run corpus:chunk`,
    );
  }
  const raw = readFileSync(_chunksPath, "utf8");
  const out: Chunk[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    out.push(JSON.parse(trimmed) as Chunk);
  }
  return out;
}

function buildIndex(): NonNullable<typeof _index> {
  const chunks = loadChunks();
  const indexed: IndexedChunk[] = [];
  const docFreq = new Map<string, number>();

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    indexed.push({ chunk, termFreq: tf, length: tokens.length });
    for (const term of tf.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }

  const totalLength = indexed.reduce((sum, ic) => sum + ic.length, 0);
  const avgLength = totalLength / indexed.length;

  return {
    chunks: indexed,
    docFreq,
    avgLength,
    totalDocs: indexed.length,
  };
}

function getIndex(): NonNullable<typeof _index> {
  if (_index) return _index;
  _index = buildIndex();
  return _index;
}

function idf(term: string, N: number, df: number): number {
  // Lucene-style BM25 IDF: clamps to 0 for terms that appear in more than
  // half the corpus (which on our small corpus is a real concern for very
  // common policy terms like "medicare").
  return Math.max(0, Math.log((N - df + 0.5) / (df + 0.5) + 1));
}

function bm25Score(queryTokens: string[], indexed: IndexedChunk, idx: NonNullable<typeof _index>): number {
  let score = 0;
  for (const term of queryTokens) {
    const tf = indexed.termFreq.get(term) ?? 0;
    if (tf === 0) continue;
    const df = idx.docFreq.get(term) ?? 0;
    const termIdf = idf(term, idx.totalDocs, df);
    const numerator = tf * (K1 + 1);
    const denominator = tf + K1 * (1 - B + B * (indexed.length / idx.avgLength));
    score += termIdf * (numerator / denominator);
  }
  return score;
}

export function search(query: string, topK = 5): RetrievalResult[] {
  const idx = getIndex();
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored: RetrievalResult[] = [];
  for (const indexed of idx.chunks) {
    const score = bm25Score(tokens, indexed, idx);
    if (score > 0) scored.push({ chunk: indexed.chunk, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** Diagnostic: corpus stats for the README + interview discussion. */
export function indexStats(): {
  totalChunks: number;
  uniqueTerms: number;
  avgChunkLength: number;
  documents: { document: string; chunks: number }[];
} {
  const idx = getIndex();
  const byDoc = new Map<string, number>();
  for (const ic of idx.chunks) {
    byDoc.set(ic.chunk.document, (byDoc.get(ic.chunk.document) ?? 0) + 1);
  }
  return {
    totalChunks: idx.totalDocs,
    uniqueTerms: idx.docFreq.size,
    avgChunkLength: Math.round(idx.avgLength),
    documents: Array.from(byDoc.entries())
      .map(([document, chunks]) => ({ document, chunks }))
      .sort((a, b) => b.chunks - a.chunks),
  };
}
