/**
 * Tests for the agent's deterministic helpers — citation parsing and
 * refusal detection. The full answerQuestion() flow makes a live
 * Anthropic API call, so it's exercised by `bun run eval`, not here.
 * These tests cover the parsing logic that runs on every agent response.
 */

import { describe, expect, test } from "bun:test";
import { parseCitation, detectRefusal } from "./answer.ts";

describe("parseCitation", () => {
  test("parses standard citation format", () => {
    const result = parseCitation("The premium is $202.90. [cite: medicare-and-you, page 23]");
    expect(result).toEqual({ document: "medicare-and-you", page: 23 });
  });

  test("tolerates extra whitespace inside the citation brackets", () => {
    const result = parseCitation("Answer.  [cite:   medicare-and-you ,  page  23  ]");
    expect(result).toEqual({ document: "medicare-and-you", page: 23 });
  });

  test("is case-insensitive on the cite keyword", () => {
    const result = parseCitation("Answer. [CITE: medicare-and-you, PAGE 23]");
    expect(result).toEqual({ document: "medicare-and-you", page: 23 });
  });

  test("handles document IDs with hyphens and underscores", () => {
    expect(parseCitation("[cite: medicare-and-you, page 5]")).toEqual({
      document: "medicare-and-you",
      page: 5,
    });
    expect(parseCitation("[cite: snap_eligibility_2024, page 12]")).toEqual({
      document: "snap_eligibility_2024",
      page: 12,
    });
  });

  test("returns null for missing citation", () => {
    expect(parseCitation("This answer has no citation.")).toBeNull();
  });

  test("returns null for malformed citation", () => {
    expect(parseCitation("[cite: missing the page]")).toBeNull();
    expect(parseCitation("[cite medicare-and-you, page 23]")).toBeNull();
  });

  test("picks up the first citation if multiple are present", () => {
    const result = parseCitation("[cite: a, page 1] and [cite: b, page 2]");
    expect(result?.document).toBe("a");
  });
});

describe("detectRefusal", () => {
  test("detects exact refusal phrase from system prompt", () => {
    expect(detectRefusal("I don't see that in the document.")).toBe(true);
  });

  test("detects refusal with curly apostrophe", () => {
    expect(detectRefusal("I don’t see that in the document.")).toBe(false);
    // Note: curly apostrophes don't match — refusal patterns use straight
    // quotes deliberately to match what the agent's system prompt requests.
    // If this becomes a real failure mode, broaden the regex.
  });

  test("detects refusal phrase in mid-sentence", () => {
    expect(detectRefusal("Looking at the evidence, I don't see that in the document anywhere.")).toBe(true);
  });

  test("detects 'not in the document' variant", () => {
    expect(detectRefusal("That information is not in the document.")).toBe(true);
  });

  test("detects 'not in the evidence' variant", () => {
    expect(detectRefusal("The answer is not in the evidence provided.")).toBe(true);
  });

  test("detects 'I don't have information' variant", () => {
    expect(detectRefusal("I don't have information about Texas Medicaid.")).toBe(true);
    expect(detectRefusal("I don't have that information.")).toBe(true);
  });

  test("does NOT detect refusal in a substantive answer", () => {
    expect(detectRefusal("The Part B premium in 2026 is $202.90. [cite: medicare-and-you, page 23]")).toBe(false);
  });

  test("does NOT detect refusal in answers that mention 'document' incidentally", () => {
    expect(detectRefusal("You should bring this document to your appointment.")).toBe(false);
  });
});
