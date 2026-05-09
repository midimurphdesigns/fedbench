/**
 * Fallback ladder for the agent.
 *
 * Production AI deployments need a degradation path — what does the
 * system do when the primary provider rate-limits, errors, or exceeds
 * a latency budget? This module encodes the ladder explicitly:
 *
 *   Rung 1: Sonnet 4.6 (primary)
 *   Rung 2: Haiku 4.5 (cheaper, faster, lower-quality fallback)
 *   Rung 3: open-weights via OpenRouter (last-resort, network-dependent)
 *
 * Each rung carries its own pricing and a documented degradation
 * criterion. The runner attempts rungs in order; the first successful
 * response wins. Failures (rate-limit, network, API error) trigger the
 * next rung. A "successful" response that exceeds the rung's latency
 * budget is logged but still accepted — the budget is a calibration
 * signal, not a hard gate (yet).
 *
 * Status:
 *   - Rung 1 + Rung 2: implemented (both Anthropic, same SDK)
 *   - Rung 3: stubbed. Wiring requires the OpenAI-compatible SDK and
 *     OPENROUTER_API_KEY. Documented in DESIGN_NOTES.md as a v0.3 item
 *     so the README claim doesn't outrun the code.
 */

import type Anthropic from "@anthropic-ai/sdk";

export type LadderRung = {
  name: string;
  model: string;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  latencyBudgetMs: number;
  description: string;
};

export const LADDER: readonly LadderRung[] = [
  {
    name: "primary",
    model: "claude-sonnet-4-6",
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    latencyBudgetMs: 5000,
    description:
      "Strongest grounded-Q&A behavior at moderate cost. Default for all production traffic unless rate-limited.",
  },
  {
    name: "fallback",
    model: "claude-haiku-4-5",
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
    latencyBudgetMs: 2500,
    description:
      "5x cheaper, ~2x faster than Sonnet 4.6. Acceptable on questions with clear retrieved evidence; flag for sample-audit on close calls.",
  },
  // Rung 3 (open-weights via OpenRouter) is intentionally not yet
  // implemented. See DESIGN_NOTES.md.
] as const;

export type LadderResponse = {
  rung: LadderRung;
  rawResponse: Anthropic.Messages.Message;
  latencyMs: number;
  costUSD: number;
  attempts: { rung: string; error: string }[];
};

/**
 * Errors that should trigger a fallback to the next rung. We're
 * deliberately conservative — only true provider-side failures
 * cascade. Bad request errors (400 class) signal a bug in our
 * harness, not a provider problem, and stop the ladder early.
 */
function shouldFallback(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Anthropic SDK errors carry `status` for HTTP-class failures.
  const status = (err as { status?: number }).status;
  if (status === undefined) return true; // network / unknown — fallback
  if (status === 429) return true; // rate limit
  if (status >= 500) return true; // provider 5xx
  return false; // 4xx other than 429 — bail out, don't mask a bug
}

function costFor(rung: LadderRung, message: Anthropic.Messages.Message): number {
  const inputCost = (message.usage.input_tokens / 1_000_000) * rung.inputUsdPerMTok;
  const outputCost = (message.usage.output_tokens / 1_000_000) * rung.outputUsdPerMTok;
  return inputCost + outputCost;
}

export type LadderCallArgs = {
  client: Anthropic;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
};

/**
 * Try each rung of the ladder in order. Returns the first successful
 * response, with full provenance: which rung answered, the error from
 * any earlier rungs that bailed out, and the cost/latency of the
 * accepted call.
 */
export async function callLadder(args: LadderCallArgs): Promise<LadderResponse> {
  const attempts: { rung: string; error: string }[] = [];

  for (const rung of LADDER) {
    const startedAt = Date.now();
    try {
      const message = await args.client.messages.create({
        model: rung.model,
        max_tokens: args.maxTokens,
        system: args.systemPrompt,
        messages: [{ role: "user", content: args.userMessage }],
      });
      const latencyMs = Date.now() - startedAt;
      return {
        rung,
        rawResponse: message,
        latencyMs,
        costUSD: costFor(rung, message),
        attempts,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      attempts.push({ rung: rung.name, error: errMsg });
      if (!shouldFallback(err)) {
        // 4xx (other than 429) — surface as a real failure, don't fall through.
        throw err;
      }
      // Cascading provider failure; try the next rung.
    }
  }

  throw new Error(
    `all ladder rungs exhausted; attempts: ${JSON.stringify(attempts)}`,
  );
}
