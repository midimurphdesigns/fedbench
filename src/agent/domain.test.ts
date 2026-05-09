/**
 * Tests for the domain-config parameterization. The system prompt is
 * the only meaningfully domain-coupled piece of the agent — these
 * tests pin its behavior across the supported domains and confirm
 * the lookup helpers reject unknown ids.
 */

import { describe, expect, test } from "bun:test";
import {
  buildSystemPrompt,
  getDomain,
  DOMAINS,
  MEDICARE_DOMAIN,
  OSHA_DOMAIN,
} from "./domain.ts";

describe("DomainConfig registry", () => {
  test("DOMAINS contains medicare and osha", () => {
    expect(DOMAINS.medicare).toBeDefined();
    expect(DOMAINS.osha).toBeDefined();
  });

  test("MEDICARE_DOMAIN id matches its key in DOMAINS", () => {
    expect(MEDICARE_DOMAIN.id).toBe("medicare");
    expect(DOMAINS.medicare).toBe(MEDICARE_DOMAIN);
  });

  test("OSHA_DOMAIN id matches its key in DOMAINS", () => {
    expect(OSHA_DOMAIN.id).toBe("osha");
    expect(DOMAINS.osha).toBe(OSHA_DOMAIN);
  });

  test("every domain has non-empty description and publicationsLabel", () => {
    for (const [, domain] of Object.entries(DOMAINS)) {
      expect(domain.description.length).toBeGreaterThan(0);
      expect(domain.publicationsLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("getDomain()", () => {
  test("returns MEDICARE_DOMAIN for 'medicare'", () => {
    expect(getDomain("medicare")).toBe(MEDICARE_DOMAIN);
  });

  test("returns OSHA_DOMAIN for 'osha'", () => {
    expect(getDomain("osha")).toBe(OSHA_DOMAIN);
  });

  test("throws on unknown domain id", () => {
    expect(() => getDomain("not-a-real-domain")).toThrow(/unknown domain/);
  });

  test("error message lists available domains", () => {
    try {
      getDomain("unknown");
      throw new Error("should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("medicare");
      expect(msg).toContain("osha");
    }
  });
});

describe("buildSystemPrompt()", () => {
  test("Medicare prompt mentions Medicare publications", () => {
    const prompt = buildSystemPrompt(MEDICARE_DOMAIN);
    expect(prompt).toContain("Medicare publications");
    expect(prompt).toContain("benefits-policy");
  });

  test("OSHA prompt mentions OSHA publications", () => {
    const prompt = buildSystemPrompt(OSHA_DOMAIN);
    expect(prompt).toContain("OSHA publications");
    expect(prompt).toContain("workplace-safety");
  });

  test("Medicare prompt does NOT mention OSHA, and vice versa", () => {
    const med = buildSystemPrompt(MEDICARE_DOMAIN);
    const osha = buildSystemPrompt(OSHA_DOMAIN);
    expect(med).not.toContain("OSHA");
    expect(osha).not.toContain("Medicare");
  });

  test("citation format is constant across domains", () => {
    const med = buildSystemPrompt(MEDICARE_DOMAIN);
    const osha = buildSystemPrompt(OSHA_DOMAIN);
    // The deterministic citation-check + judge depend on this format.
    // If a future domain ever needs a different citation shape, every
    // downstream layer needs an update. Test pins the shape so a drift
    // surfaces here first.
    expect(med).toContain("[cite: <document-id>, page <N>]");
    expect(osha).toContain("[cite: <document-id>, page <N>]");
  });

  test("refusal rule is constant across domains", () => {
    const med = buildSystemPrompt(MEDICARE_DOMAIN);
    const osha = buildSystemPrompt(OSHA_DOMAIN);
    expect(med).toContain("I don't see that in the document.");
    expect(osha).toContain("I don't see that in the document.");
  });
});
