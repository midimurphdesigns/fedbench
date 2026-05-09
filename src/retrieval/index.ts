/**
 * Retriever interface — the seam where future retrieval strategies plug in.
 *
 * v0.3 ships one concrete implementation (BM25) and a stub for a hybrid
 * BM25+lexical-reranker. The interface exists so a future eval can run the
 * same agent and same Q&A pairs against multiple retrievers and let the
 * harness measure which one wins on a given domain — that comparison is
 * the actual FDE skill, not "I picked the right retriever up front."
 *
 * To add a new retriever:
 *   1. Implement `Retriever` in src/retrieval/<name>.ts
 *   2. Export it through this barrel
 *   3. Add the new corpus-shape to a future RetrieverChoice union if
 *      the eval needs to switch retrievers via CLI flag
 *
 * The agent currently calls bm25.search() directly. A future PR will
 * route that through the configured Retriever so the eval can swap
 * implementations without changing agent code.
 */

import type { Chunk } from "../corpus/chunk.ts";

export type RetrievalResult = {
  chunk: Chunk;
  score: number;
};

export interface Retriever {
  /** Short identifier used in eval reports (e.g., "bm25", "hybrid"). */
  readonly name: string;
  /** Top-K most relevant chunks for the query. */
  search(query: string, topK?: number): RetrievalResult[];
}

export { search as bm25Search, bm25Retriever, indexStats, setCorpus } from "./bm25.ts";
export { hybridRetriever } from "./hybrid.ts";
