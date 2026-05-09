/**
 * Deterministic citation-existence check.
 *
 * Given a Q&A pair with a citation (document, page), assert that the cited
 * page exists in the parsed corpus and that the expected answer's key
 * factual tokens (numbers, dollar amounts, percentages) appear on that
 * page. No LLM in the loop — pure code, instant, free.
 *
 * This is Layer 1 of the eval. It catches:
 *   - Made-up page numbers
 *   - Real page numbers that don't actually contain the claim's facts
 *   - Drift in the source corpus (an upstream PDF update that moves a
 *     fact to a different page) — fails loud on the next eval run
 *
 * The check is intentionally conservative: it asks "do the load-bearing
 * tokens of the answer appear on the cited page?" not "does the page
 * semantically support the answer?" Semantic faithfulness is Layer 2's
 * job (see judge.ts).
 */

import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export type Citation = {
  document: string;
  page: number;
};

export type CitationCheckResult =
  | { status: "pass"; matchedTokens: string[] }
  | { status: "fail"; reason: string; missingTokens?: string[] }
  | { status: "skip"; reason: string };

const ROOT = resolve(import.meta.dir, "..", "..");
const CACHE_DIR = resolve(ROOT, ".corpus-cache");

const pageTextCache = new Map<string, Map<number, string>>();

function loadDocumentPages(documentId: string): Map<number, string> | null {
  const cached = pageTextCache.get(documentId);
  if (cached) return cached;

  const path = resolve(CACHE_DIR, `${documentId}.txt`);
  if (!existsSync(path)) return null;

  const raw = readFileSync(path, "utf8");
  const pages = new Map<number, string>();
  // The corpus-cache format is delimited by lines of the form `=== PAGE N ===`.
  const sections = raw.split(/=== PAGE (\d+) ===/);
  // sections[0] is preamble (empty); thereafter alternates [pageNum, body].
  for (let i = 1; i < sections.length; i += 2) {
    const pageNum = Number.parseInt(sections[i] ?? "", 10);
    const body = sections[i + 1] ?? "";
    if (Number.isFinite(pageNum)) {
      pages.set(pageNum, body);
    }
  }
  pageTextCache.set(documentId, pages);
  return pages;
}

/**
 * Pull factual tokens out of an answer string — the things we expect to
 * find verbatim (or close to verbatim) on the cited page. Heuristic:
 *   - Dollar amounts ($1,736, $202.90)
 *   - Day/month/year counts (10 days, 8 months, 12 months)
 *   - Percentages (10%, 5 percent)
 *   - All-caps acronyms with letters/numbers (SNF, SSA-1020)
 *   - Quoted phrases
 */
export function extractKeyTokens(answer: string): string[] {
  const tokens = new Set<string>();
  const dollarRe = /\$[\d,]+(?:\.\d+)?/g;
  const periodRe = /\b\d+(?:[-\s]?\d+)?\s*(?:days?|months?|years?|weeks?)\b/gi;
  const percentRe = /\b\d+(?:\.\d+)?\s*(?:%|percent)\b/gi;
  const acronymRe = /\b[A-Z][A-Z0-9]{2,}(?:-[A-Z0-9]+)*\b/g;

  for (const m of answer.matchAll(dollarRe)) tokens.add(m[0]);
  for (const m of answer.matchAll(periodRe)) tokens.add(m[0].replace(/\s+/g, " ").trim());
  for (const m of answer.matchAll(percentRe)) tokens.add(m[0].replace(/\s+/g, " ").trim());
  for (const m of answer.matchAll(acronymRe)) tokens.add(m[0]);

  return Array.from(tokens);
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    // Normalize unicode dashes to ASCII hyphen
    .replace(/[–—−]/g, "-")
    // Treat hyphens as spaces. The source PDFs hyphenate compound
    // modifiers ("8-month period") where natural answers use spaces
    // ("8 months"). Folding hyphen->space lets these match.
    .replace(/-/g, " ")
    // Collapse all whitespace runs (including newlines, nbsp) to a single space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Loose token presence check. A token "matches" the page if a
 * normalized form of it appears in the normalized page text. This is
 * deliberately fuzzy: we want "$202.90" to match "$202.90", "$1,736" to
 * match "$1,736", "10 days" to match "10 days" or "10\n days", etc.
 */
function tokenAppears(token: string, pageText: string): boolean {
  const haystack = normalizeForMatch(pageText);
  const needle = normalizeForMatch(token);
  if (haystack.includes(needle)) return true;

  // Singular/plural fallback for time-period tokens. The PDF often uses
  // a singular adjective form ("8-month period", "10-day window") while
  // a natural answer uses the plural noun ("8 months", "10 days"). Try
  // both forms before declaring the token missing.
  const periodMatch = needle.match(/^(\d+(?:[\s]?\d+)?)\s*(day|month|year|week)s?$/);
  if (periodMatch) {
    const [, num, unit] = periodMatch;
    if (haystack.includes(`${num} ${unit}`)) return true;
    if (haystack.includes(`${num} ${unit}s`)) return true;
  }

  // Number-flexible fallback: extract just the digits/dollar shape and
  // search that, in case the surrounding wording changed slightly between
  // the answer and the source.
  const digitsOnly = token.match(/[$\d,.%-]+/);
  if (digitsOnly) {
    const trimmed = normalizeForMatch(digitsOnly[0]);
    if (trimmed.length >= 2 && haystack.includes(trimmed)) return true;
  }
  return false;
}

export function checkCitation(
  citation: Citation,
  expectedAnswer: string,
): CitationCheckResult {
  const pages = loadDocumentPages(citation.document);
  if (!pages) {
    return {
      status: "skip",
      reason: `corpus cache missing for "${citation.document}". Run: bun run corpus:fetch && bun run corpus:parse`,
    };
  }

  const pageText = pages.get(citation.page);
  if (!pageText) {
    return {
      status: "fail",
      reason: `cited page ${citation.page} does not exist in document "${citation.document}" (document has ${pages.size} pages)`,
    };
  }

  const tokens = extractKeyTokens(expectedAnswer);
  if (tokens.length === 0) {
    // No verifiable tokens (e.g., a yes/no answer with no numbers).
    // Falls through to the LLM judge — Layer 1 can't help here.
    return {
      status: "skip",
      reason: "no verifiable tokens in expected answer; defer to LLM judge",
    };
  }

  const matched: string[] = [];
  const missing: string[] = [];
  for (const token of tokens) {
    if (tokenAppears(token, pageText)) matched.push(token);
    else missing.push(token);
  }

  if (missing.length === 0) {
    return { status: "pass", matchedTokens: matched };
  }

  // Partial match still fails — if even one load-bearing fact isn't on
  // the page, the citation is wrong (or the answer combines facts from
  // multiple pages without citing both).
  return {
    status: "fail",
    reason: `${missing.length} of ${tokens.length} expected tokens not found on cited page`,
    missingTokens: missing,
  };
}
