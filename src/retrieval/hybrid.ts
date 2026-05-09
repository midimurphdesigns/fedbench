/**
 * Hybrid BM25 + lexical reranker — STUB.
 *
 * v0.3 ships this as a structural seam, not a working retriever. The
 * design call lives in docs/DESIGN_NOTES.md: hybrid retrieval is the
 * cleanest upgrade path if a future domain shows BM25 hurting accuracy,
 * but we don't add it speculatively. The retriever earns its keep by
 * measurement, not assumption.
 *
 * The intended shape (when this is built out):
 *   1. Run BM25 to get a top-N candidate list (N = 3 * topK).
 *   2. Re-rank candidates with a cheap lexical scorer (e.g., span-overlap
 *      against the query, query-term coverage, page-position bias).
 *   3. Return the top-K reranked results.
 *
 * Why a *lexical* reranker (not a dense reranker like a cross-encoder):
 *   - Stays self-hostable (no embedding API, no model download).
 *   - Cheap enough to run inside the BM25 candidate window without
 *     blowing the harness's "fork it and run it on a laptop" property.
 *   - The retrieval-shape comparison fedbench is built to measure is
 *     "does adding any reranker help" — that signal shows up in the
 *     simplest reranker first.
 *
 * If/when this is implemented, add a tracked entry to DESIGN_NOTES.md
 * describing the empirical case for it (which corpus surfaced the gap,
 * what the BM25 verdict was, how much hybrid moved the numbers).
 */

import type { Retriever, RetrievalResult } from "./index.ts";
import { search as bm25Search } from "./bm25.ts";

export const hybridRetriever: Retriever = {
  name: "hybrid",
  search(query: string, topK = 5): RetrievalResult[] {
    // TODO(v0.4+): replace with real BM25 → lexical-rerank pipeline.
    // For now, falls through to plain BM25 so the seam is testable
    // without lying about the retriever's capabilities. Any caller
    // that switches to the hybrid retriever before it ships will get
    // BM25 results with a "hybrid" label — fine for plumbing checks,
    // not for headline numbers.
    return bm25Search(query, topK);
  },
};
