/**
 * Per-corpus path helpers for the multi-corpus harness.
 *
 * Layout (a single corpus key like "medicare" or "osha" picks the lane):
 *
 *   corpus/sources.<id>.json          — manifest (URL + sha256 + scope)
 *   corpus/raw/<id>/<doc>.pdf         — fetched PDFs
 *   .corpus-cache/<id>/<doc>.txt      — pypdf-parsed text per document
 *   .corpus-cache/<id>/chunks.jsonl   — chunked passages for retrieval
 *   eval/questions.<id>.jsonl         — verified Q&A pairs
 *
 * The default corpus is "medicare" — it's what existed before the
 * second-domain refactor and what `bun run eval` (no flag) keeps
 * targeting.
 *
 * For backwards compatibility with the original v0.2 layout, when
 * the corpus is "medicare" and the legacy paths exist on disk
 * (corpus/sources.json, corpus/raw/<doc>.pdf, .corpus-cache/<doc>.txt,
 * eval/questions.jsonl) those are preferred. New corpora always use
 * the namespaced layout above.
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolve(import.meta.dir, "..", "..");

const DEFAULT_CORPUS_ENV = "FEDBENCH_CORPUS";
export const DEFAULT_CORPUS = "medicare";

export type CorpusPaths = {
  id: string;
  manifest: string;
  rawDir: string;
  cacheDir: string;
  chunksPath: string;
  questionsPath: string;
};

/**
 * Resolve a CLI argv into a corpus id. Looks for `--corpus <id>` or
 * `--corpus=<id>`; falls back to FEDBENCH_CORPUS env, then DEFAULT_CORPUS.
 */
export function resolveCorpusFromArgv(argv: readonly string[]): string {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === "--corpus" && argv[i + 1]) return argv[i + 1] as string;
    if (arg.startsWith("--corpus=")) return arg.slice("--corpus=".length);
  }
  return process.env[DEFAULT_CORPUS_ENV] ?? DEFAULT_CORPUS;
}

/**
 * Process-wide active corpus, set by `activateCorpus(id)`. Modules
 * that need cache access mid-run (BM25, citation-check, judge) read
 * from `getActiveCorpusPaths()` rather than recomputing from a CLI
 * arg they don't see.
 */
let _activeCorpusId: string = DEFAULT_CORPUS;

export function activateCorpus(id: string): void {
  _activeCorpusId = id;
}

export function getActiveCorpusId(): string {
  return _activeCorpusId;
}

export function getActiveCorpusPaths(): CorpusPaths {
  return getCorpusPaths(_activeCorpusId);
}

export function getCorpusPaths(id: string = DEFAULT_CORPUS): CorpusPaths {
  // Legacy Medicare layout: keep working without forcing a re-shuffle
  // of files that the v0.2 release pinned to disk.
  const legacyManifest = resolve(ROOT, "corpus", "sources.json");
  const legacyCache = resolve(ROOT, ".corpus-cache");
  const legacyChunks = resolve(legacyCache, "chunks.jsonl");
  const legacyQuestions = resolve(ROOT, "eval", "questions.jsonl");
  const legacyRaw = resolve(ROOT, "corpus", "raw");

  if (id === "medicare" && existsSync(legacyManifest)) {
    return {
      id,
      manifest: legacyManifest,
      rawDir: legacyRaw,
      cacheDir: legacyCache,
      chunksPath: legacyChunks,
      questionsPath: legacyQuestions,
    };
  }

  // Namespaced layout for new corpora.
  const cacheDir = resolve(ROOT, ".corpus-cache", id);
  return {
    id,
    manifest: resolve(ROOT, "corpus", `sources.${id}.json`),
    rawDir: resolve(ROOT, "corpus", "raw", id),
    cacheDir,
    chunksPath: resolve(cacheDir, "chunks.jsonl"),
    questionsPath: resolve(ROOT, "eval", `questions.${id}.jsonl`),
  };
}
