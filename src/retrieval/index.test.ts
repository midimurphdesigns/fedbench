/**
 * Tests for the Retriever interface seam. The point of these tests is
 * not to re-test BM25 (that's bm25.test.ts) — it's to prove the seam
 * itself: that bm25Retriever and hybridRetriever both satisfy the
 * Retriever interface and can be swapped without changing call-site
 * code.
 */

import { describe, expect, test } from "bun:test";
import type { Retriever } from "./index.ts";
import { bm25Retriever, hybridRetriever } from "./index.ts";

describe("Retriever interface", () => {
  test("bm25Retriever has the expected name", () => {
    expect(bm25Retriever.name).toBe("bm25");
  });

  test("hybridRetriever has the expected name", () => {
    expect(hybridRetriever.name).toBe("hybrid");
  });

  test("both retrievers conform to the Retriever interface", () => {
    const retrievers: Retriever[] = [bm25Retriever, hybridRetriever];
    for (const r of retrievers) {
      expect(typeof r.name).toBe("string");
      expect(typeof r.search).toBe("function");
    }
  });

  test("calling search() returns an array", () => {
    // Use a query that won't blow up if the corpus index is empty —
    // both retrievers should at minimum return a (possibly empty) array.
    const results = bm25Retriever.search("medicare premium", 1);
    expect(Array.isArray(results)).toBe(true);
  });

  test("hybrid retriever currently delegates to BM25 (stub)", () => {
    // This test pins the v0.3 stub behavior: hybrid is structural seam
    // only, returning the same results as BM25. When v0.4+ implements
    // the real reranker, this test should be replaced with one that
    // proves the rerank actually changes the order on a known query.
    const bm25Results = bm25Retriever.search("medicare premium", 3);
    const hybridResults = hybridRetriever.search("medicare premium", 3);
    expect(hybridResults.length).toBe(bm25Results.length);
    for (let i = 0; i < bm25Results.length; i++) {
      const a = bm25Results[i];
      const b = hybridResults[i];
      if (!a || !b) continue;
      expect(b.chunk.chunkId).toBe(a.chunk.chunkId);
    }
  });
});
