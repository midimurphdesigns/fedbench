/**
 * Tests for the fallback ladder — focuses on the rung table, the cost
 * computation, and the cascade behavior. The full callLadder() flow
 * makes live API calls; integration coverage runs in `bun run eval`.
 */

import { describe, expect, test } from "bun:test";
import { LADDER, callLadder } from "./fallback-ladder.ts";

describe("LADDER configuration", () => {
  test("has at least one rung", () => {
    expect(LADDER.length).toBeGreaterThan(0);
  });

  test("primary rung is named 'primary' and uses Sonnet", () => {
    const primary = LADDER[0];
    expect(primary).toBeDefined();
    if (primary) {
      expect(primary.name).toBe("primary");
      expect(primary.model).toContain("sonnet");
    }
  });

  test("each rung has documented pricing and a latency budget", () => {
    for (const rung of LADDER) {
      expect(rung.inputUsdPerMTok).toBeGreaterThan(0);
      expect(rung.outputUsdPerMTok).toBeGreaterThan(0);
      expect(rung.latencyBudgetMs).toBeGreaterThan(0);
      expect(rung.description.length).toBeGreaterThan(20);
    }
  });

  test("fallback rungs are cheaper than the primary", () => {
    const primary = LADDER[0];
    if (!primary) return;
    for (let i = 1; i < LADDER.length; i++) {
      const rung = LADDER[i];
      if (!rung) continue;
      expect(rung.inputUsdPerMTok).toBeLessThanOrEqual(primary.inputUsdPerMTok);
      expect(rung.outputUsdPerMTok).toBeLessThanOrEqual(primary.outputUsdPerMTok);
    }
  });

  test("rung names are unique", () => {
    const names = LADDER.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("callLadder error cascade", () => {
  // Mock client that fails the primary rung with a 429, then succeeds.
  function mockClient(failures: { status?: number; message?: string }[]) {
    let callCount = 0;
    return {
      messages: {
        create: async () => {
          const idx = callCount++;
          const failure = failures[idx];
          if (failure) {
            const err = new Error(failure.message ?? "rate limited");
            (err as Error & { status?: number }).status = failure.status;
            throw err;
          }
          return {
            id: "msg_test",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "test response" }],
            model: LADDER[callCount - 1]?.model ?? "test",
            usage: { input_tokens: 100, output_tokens: 50 },
          };
        },
      },
    };
  }

  test("returns first-rung response when primary succeeds", async () => {
    const client = mockClient([]);
    // biome-ignore lint: mock client deliberately doesn't implement full Anthropic interface
    const result = await callLadder({ client: client as never, systemPrompt: "x", userMessage: "y", maxTokens: 100 });
    expect(result.rung.name).toBe("primary");
    expect(result.attempts).toEqual([]);
  });

  test("falls back to next rung on 429 rate-limit error", async () => {
    if (LADDER.length < 2) {
      console.log("  skipping: ladder has only one rung");
      return;
    }
    const client = mockClient([{ status: 429, message: "rate limited" }]);
    // biome-ignore lint: mock client deliberately doesn't implement full Anthropic interface
    const result = await callLadder({ client: client as never, systemPrompt: "x", userMessage: "y", maxTokens: 100 });
    expect(result.rung.name).not.toBe("primary");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.rung).toBe("primary");
  });

  test("falls back on 5xx provider errors", async () => {
    if (LADDER.length < 2) return;
    const client = mockClient([{ status: 503, message: "service unavailable" }]);
    // biome-ignore lint: mock client deliberately doesn't implement full Anthropic interface
    const result = await callLadder({ client: client as never, systemPrompt: "x", userMessage: "y", maxTokens: 100 });
    expect(result.rung.name).not.toBe("primary");
  });

  test("does NOT fall back on 4xx client errors (other than 429)", async () => {
    const client = mockClient([{ status: 400, message: "bad request — bug in our prompt" }]);
    // biome-ignore lint: mock client deliberately doesn't implement full Anthropic interface
    expect(callLadder({ client: client as never, systemPrompt: "x", userMessage: "y", maxTokens: 100 }))
      .rejects.toThrow("bad request");
  });

  test("computes cost using the rung that actually answered, not the primary", async () => {
    if (LADDER.length < 2) return;
    const client = mockClient([{ status: 429 }]);
    // biome-ignore lint: mock client deliberately doesn't implement full Anthropic interface
    const result = await callLadder({ client: client as never, systemPrompt: "x", userMessage: "y", maxTokens: 100 });
    const fallbackRung = LADDER[1];
    if (!fallbackRung) return;
    const expectedInputCost = (100 / 1_000_000) * fallbackRung.inputUsdPerMTok;
    const expectedOutputCost = (50 / 1_000_000) * fallbackRung.outputUsdPerMTok;
    expect(result.costUSD).toBeCloseTo(expectedInputCost + expectedOutputCost, 8);
  });
});
