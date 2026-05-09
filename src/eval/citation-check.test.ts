/**
 * Tests for the deterministic citation-check layer.
 *
 * These tests focus on the parts of citation-check.ts that don't require
 * the corpus cache: the token extractor and the (private, not exported)
 * matching behavior, exercised through extractKeyTokens.
 *
 * checkCitation() itself depends on parsed PDF text from .corpus-cache/;
 * its end-to-end behavior is exercised by the eval runner, not unit-tested
 * here. Unit-testing it would require checking in fixture text, which
 * fights the "corpus is reproducible from sources.json" rule.
 */

import { describe, expect, test } from "bun:test";
import { extractKeyTokens } from "./citation-check.ts";

describe("extractKeyTokens", () => {
  test("extracts dollar amounts with commas and decimals", () => {
    const tokens = extractKeyTokens("The premium is $202.90 and the deductible is $1,736.");
    expect(tokens).toContain("$202.90");
    expect(tokens).toContain("$1,736");
  });

  test("extracts day/month/year periods", () => {
    const tokens = extractKeyTokens("Within 10 days, the 8 months SEP, or 12 months penalty.");
    expect(tokens).toContain("10 days");
    expect(tokens).toContain("8 months");
    expect(tokens).toContain("12 months");
  });

  test("extracts percentages in both formats", () => {
    const tokens = extractKeyTokens("The penalty is 10% per year, or 5 percent for hospice.");
    expect(tokens).toContain("10%");
    expect(tokens).toContain("5 percent");
  });

  test("extracts uppercase acronyms with hyphens and digits", () => {
    const tokens = extractKeyTokens("Form SSA-1020 for SNF and IRMAA coverage.");
    expect(tokens).toContain("SSA-1020");
    expect(tokens).toContain("SNF");
    expect(tokens).toContain("IRMAA");
  });

  test("returns empty array for an answer with no extractable tokens", () => {
    const tokens = extractKeyTokens("No, that benefit is not covered.");
    expect(tokens).toEqual([]);
  });

  test("deduplicates repeated tokens", () => {
    const tokens = extractKeyTokens("$1,736 deductible and $1,736 again");
    expect(tokens.filter((t) => t === "$1,736")).toHaveLength(1);
  });

  test("does not pick up sentence-initial capitalized words as acronyms", () => {
    const tokens = extractKeyTokens("Medicare covers this. Coverage starts immediately.");
    expect(tokens).not.toContain("Medicare");
    expect(tokens).not.toContain("Coverage");
  });

  test("handles answers with no whitespace between tokens", () => {
    const tokens = extractKeyTokens("$2,100/$1,736");
    expect(tokens).toContain("$2,100");
    expect(tokens).toContain("$1,736");
  });
});
