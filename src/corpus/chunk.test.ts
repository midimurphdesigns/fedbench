/**
 * Tests for the corpus chunker.
 *
 * Uses real cached corpus text when present; falls back to a smoke test
 * of the module surface otherwise.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildChunks } from "./chunk.ts";

const CACHE_DIR = resolve(import.meta.dir, "..", "..", ".corpus-cache");
const HAS_CORPUS = existsSync(resolve(CACHE_DIR, "medicare-and-you.txt"));

describe.if(HAS_CORPUS)("buildChunks (with corpus)", () => {
  test("produces chunks with required metadata", () => {
    const chunks = buildChunks();
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks.slice(0, 5)) {
      expect(chunk.chunkId).toMatch(/^[a-z0-9-]+#p\d+c\d+$/);
      expect(chunk.document).toBeTruthy();
      expect(chunk.page).toBeGreaterThan(0);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  test("chunks never span page boundaries (each chunk has one page)", () => {
    const chunks = buildChunks();
    for (const chunk of chunks) {
      // chunkId encodes the page; corruption of this invariant is a
      // structural bug, not a tuning issue.
      expect(chunk.chunkId).toContain(`#p${chunk.page}c`);
    }
  });

  test("chunkIds are unique across the entire corpus", () => {
    const chunks = buildChunks();
    const ids = new Set(chunks.map((c) => c.chunkId));
    expect(ids.size).toBe(chunks.length);
  });

  test("each chunk's text is non-trivial", () => {
    const chunks = buildChunks();
    for (const chunk of chunks) {
      // A chunk should be at least a meaningful sentence — the chunker
      // shouldn't emit single-word fragments.
      expect(chunk.text.split(" ").length).toBeGreaterThan(3);
    }
  });
});

describe.if(!HAS_CORPUS)("chunk module (corpus not built)", () => {
  test("module imports succeed without corpus cache", () => {
    expect(typeof buildChunks).toBe("function");
  });
});
