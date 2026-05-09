/**
 * Tests for the per-corpus path helpers and CLI argv resolution. These
 * cover the multi-corpus seam — the routing layer that lets every
 * downstream module (fetch, chunk, retrieval, judge, citation-check)
 * stay corpus-agnostic.
 */

import { describe, expect, test, beforeEach } from "bun:test";
import {
  resolveCorpusFromArgv,
  getCorpusPaths,
  getActiveCorpusPaths,
  activateCorpus,
  getActiveCorpusId,
  DEFAULT_CORPUS,
} from "./paths.ts";

describe("resolveCorpusFromArgv()", () => {
  beforeEach(() => {
    delete process.env.FEDBENCH_CORPUS;
  });

  test("returns DEFAULT_CORPUS on empty argv with no env var", () => {
    expect(resolveCorpusFromArgv([])).toBe(DEFAULT_CORPUS);
  });

  test("parses --corpus <id> form", () => {
    expect(resolveCorpusFromArgv(["--corpus", "osha"])).toBe("osha");
  });

  test("parses --corpus=<id> form", () => {
    expect(resolveCorpusFromArgv(["--corpus=osha"])).toBe("osha");
  });

  test("falls back to FEDBENCH_CORPUS env var", () => {
    process.env.FEDBENCH_CORPUS = "osha";
    expect(resolveCorpusFromArgv([])).toBe("osha");
  });

  test("CLI flag takes precedence over env var", () => {
    process.env.FEDBENCH_CORPUS = "medicare";
    expect(resolveCorpusFromArgv(["--corpus", "osha"])).toBe("osha");
  });
});

describe("getCorpusPaths()", () => {
  test("medicare uses legacy paths (no <id> namespace)", () => {
    const paths = getCorpusPaths("medicare");
    // Legacy paths land at corpus/sources.json and .corpus-cache/<doc>.txt
    expect(paths.manifest).toMatch(/corpus\/sources\.json$/);
    expect(paths.cacheDir).toMatch(/\.corpus-cache$/);
    expect(paths.questionsPath).toMatch(/eval\/questions\.jsonl$/);
  });

  test("osha uses namespaced paths", () => {
    const paths = getCorpusPaths("osha");
    expect(paths.manifest).toMatch(/corpus\/sources\.osha\.json$/);
    expect(paths.cacheDir).toMatch(/\.corpus-cache\/osha$/);
    expect(paths.questionsPath).toMatch(/eval\/questions\.osha\.jsonl$/);
    expect(paths.rawDir).toMatch(/corpus\/raw\/osha$/);
  });

  test("paths.id matches the requested id", () => {
    expect(getCorpusPaths("medicare").id).toBe("medicare");
    expect(getCorpusPaths("osha").id).toBe("osha");
  });
});

describe("active corpus state", () => {
  test("default active corpus is the DEFAULT_CORPUS", () => {
    activateCorpus(DEFAULT_CORPUS);
    expect(getActiveCorpusId()).toBe(DEFAULT_CORPUS);
    expect(getActiveCorpusPaths().id).toBe(DEFAULT_CORPUS);
  });

  test("activateCorpus() updates getActiveCorpusPaths()", () => {
    activateCorpus("osha");
    expect(getActiveCorpusId()).toBe("osha");
    expect(getActiveCorpusPaths().id).toBe("osha");
    expect(getActiveCorpusPaths().cacheDir).toMatch(/\.corpus-cache\/osha$/);

    // restore to default so other tests aren't affected by ordering
    activateCorpus(DEFAULT_CORPUS);
  });
});
