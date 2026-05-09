/**
 * Tests for BM25 retrieval.
 *
 * The public surface (search, indexStats) reads from
 * .corpus-cache/chunks.jsonl, so these tests require the corpus to be
 * built first (`bun run corpus:fetch && bun run corpus:chunk`). They
 * skip themselves if the cache isn't present, so the test suite runs
 * cleanly in CI without API keys when the corpus hasn't been fetched.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { search, indexStats } from "./bm25.ts";

const CHUNKS_PATH = resolve(import.meta.dir, "..", "..", ".corpus-cache", "chunks.jsonl");
const HAS_CORPUS = existsSync(CHUNKS_PATH);

describe.if(HAS_CORPUS)("BM25 retrieval (with corpus)", () => {
  test("indexStats reports a non-empty corpus", () => {
    const stats = indexStats();
    expect(stats.totalChunks).toBeGreaterThan(0);
    expect(stats.uniqueTerms).toBeGreaterThan(100);
    expect(stats.documents.length).toBeGreaterThan(0);
  });

  test("returns top-K results sorted by descending score", () => {
    const results = search("Part B premium", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];
      if (prev && curr) {
        expect(prev.score).toBeGreaterThanOrEqual(curr.score);
      }
    }
  });

  test("returns empty array for empty query", () => {
    expect(search("", 5)).toEqual([]);
    expect(search("   ", 5)).toEqual([]);
  });

  test("returns empty array for stopword-only query", () => {
    // BM25 strips stopwords; "the and of" has no scorable terms.
    expect(search("the and of", 5)).toEqual([]);
  });

  test("ranks Part B premium queries near Part B premium content", () => {
    const results = search("standard Part B premium 2026", 3);
    expect(results.length).toBeGreaterThan(0);
    // The top result should reference Part B and have a non-trivial score.
    const top = results[0];
    expect(top).toBeDefined();
    if (top) {
      expect(top.score).toBeGreaterThan(1);
      // Loose match — the chunk text should mention Part B somewhere.
      expect(top.chunk.text.toLowerCase()).toContain("part b");
    }
  });

  test("ranks SNF / skilled nursing queries near SNF content", () => {
    const results = search("skilled nursing facility benefit period", 3);
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top).toBeDefined();
    if (top) {
      const text = top.chunk.text.toLowerCase();
      expect(text.includes("skilled nursing") || text.includes("snf")).toBe(true);
    }
  });

  test("returns chunks with required metadata", () => {
    const results = search("Medicare", 1);
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top).toBeDefined();
    if (top) {
      expect(top.chunk.chunkId).toBeTruthy();
      expect(top.chunk.document).toBeTruthy();
      expect(top.chunk.page).toBeGreaterThan(0);
      expect(top.chunk.text).toBeTruthy();
      expect(typeof top.score).toBe("number");
    }
  });
});

// Always-runnable fallback: if the corpus isn't built, at least confirm
// the module imports cleanly. CI catches type/syntax regressions even
// without fixture data.
describe.if(!HAS_CORPUS)("BM25 retrieval (corpus not built)", () => {
  test("module imports succeed without corpus cache", () => {
    expect(typeof search).toBe("function");
    expect(typeof indexStats).toBe("function");
  });
});
