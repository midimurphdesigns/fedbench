/**
 * Chunk the parsed corpus text into retrieval-sized passages.
 *
 *   bun run corpus:chunk
 *
 * Reads the parsed-text caches at .corpus-cache/<doc>.txt (produced by
 * Python pypdf during sourcing — see docs/ARCHITECTURE.md for why we
 * chose pypdf for the one-time parse step), splits each page into
 * sentence-aware chunks of bounded size, and writes a flat JSONL of
 * {chunkId, document, page, text} entries to .corpus-cache/chunks.jsonl.
 *
 * Design choices:
 *   - Chunks respect page boundaries. A chunk never spans two pages,
 *     which means citations are always to a single page (matches the
 *     ground-truth schema and how a caseworker would actually cite).
 *   - Chunks target ~600 words. The 3-PDF corpus produces a few hundred
 *     chunks total — small enough that BM25 search is instant, large
 *     enough that a single chunk usually contains the full answer.
 *   - No chunk overlap. Page boundaries are already a reasonable split;
 *     overlap inside a page would inflate the index without adding
 *     retrieval signal at this corpus scale.
 *   - No embedding here — that's retrieval's concern, not chunking's.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";

export type Chunk = {
  chunkId: string;
  document: string;
  page: number;
  text: string;
};

const ROOT = resolve(import.meta.dir, "..", "..");
const CACHE_DIR = resolve(ROOT, ".corpus-cache");
const CHUNKS_PATH = resolve(CACHE_DIR, "chunks.jsonl");

const TARGET_WORDS_PER_CHUNK = 600;

function chunkPageText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return [];
  const words = cleaned.split(" ");
  if (words.length <= TARGET_WORDS_PER_CHUNK) {
    return [cleaned];
  }

  // Split on sentence boundaries when possible, falling back to word
  // boundaries for runaway non-prose pages (tables, lists). Sentence
  // boundary heuristic: period or colon followed by whitespace and a
  // capital letter.
  const sentences = cleaned
    .split(/(?<=[.:;])\s+(?=[A-Z•])/g)
    .filter((s) => s.trim().length > 0);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(" ").length;
    if (currentWordCount + sentenceWords > TARGET_WORDS_PER_CHUNK && current.length > 0) {
      chunks.push(current.join(" "));
      current = [];
      currentWordCount = 0;
    }
    current.push(sentence);
    currentWordCount += sentenceWords;
  }
  if (current.length > 0) {
    chunks.push(current.join(" "));
  }
  return chunks;
}

function loadParsedDocument(documentId: string): Map<number, string> | null {
  const path = resolve(CACHE_DIR, `${documentId}.txt`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const pages = new Map<number, string>();
  const sections = raw.split(/=== PAGE (\d+) ===/);
  for (let i = 1; i < sections.length; i += 2) {
    const pageNum = Number.parseInt(sections[i] ?? "", 10);
    const body = sections[i + 1] ?? "";
    if (Number.isFinite(pageNum)) pages.set(pageNum, body);
  }
  return pages;
}

function discoverParsedDocuments(): string[] {
  if (!existsSync(CACHE_DIR)) return [];
  return readdirSync(CACHE_DIR)
    .filter((name) => name.endsWith(".txt"))
    .map((name) => name.replace(/\.txt$/, ""));
}

export function buildChunks(): Chunk[] {
  const docs = discoverParsedDocuments();
  if (docs.length === 0) {
    throw new Error(
      "no parsed text in .corpus-cache/. Run the corpus-parse step first.",
    );
  }

  const chunks: Chunk[] = [];
  for (const docId of docs) {
    const pages = loadParsedDocument(docId);
    if (!pages) continue;
    for (const [pageNum, pageText] of pages) {
      const pageChunks = chunkPageText(pageText);
      pageChunks.forEach((text, idx) => {
        chunks.push({
          chunkId: `${docId}#p${pageNum}c${idx}`,
          document: docId,
          page: pageNum,
          text,
        });
      });
    }
  }
  return chunks;
}

function main(): void {
  const chunks = buildChunks();
  const lines = chunks.map((c) => JSON.stringify(c)).join("\n") + "\n";
  writeFileSync(CHUNKS_PATH, lines);
  const docs = new Set(chunks.map((c) => c.document));
  console.log(`✓ wrote ${chunks.length} chunks across ${docs.size} documents → ${CHUNKS_PATH}`);
  // Distribution: chunks per doc
  const byDoc = new Map<string, number>();
  for (const c of chunks) byDoc.set(c.document, (byDoc.get(c.document) ?? 0) + 1);
  for (const [doc, n] of byDoc) console.log(`    ${doc}: ${n} chunks`);
}

if (import.meta.main) {
  main();
}
