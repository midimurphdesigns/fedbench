/**
 * Smoke test — verifies the Anthropic SDK is wired correctly and that the
 * model holds a structured grounded-Q&A prompt against a stub policy snippet.
 * No PDF retrieval, no eval scoring; just a single end-to-end provider call
 * useful for CI sanity-checking and local setup verification.
 *
 *   bun run smoke
 */

import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY missing. cp .env.example .env and add your key.");
  process.exit(1);
}

const client = new Anthropic({ apiKey });

// Stand-in policy snippet — one paragraph the agent must answer from.
// In the full eval pipeline, this is replaced by retrieved chunks from
// the parsed corpus.
const POLICY_CONTEXT = `
SSA-1020 (Application for Extra Help with Medicare Prescription Drug Plan Costs).
Recipients of Medicaid benefits must report any change in income within 10 days
of the change taking effect. Failure to report a change within the 10-day window
may result in an overpayment determination, which the recipient is liable to repay.
Reports may be filed via the SSA's online portal, by phone at 1-800-772-1213, or
by appointment at a local Social Security office. Page 14, section 4.2.
`.trim();

const SYSTEM_PROMPT = `
You are a caseworker assistant for a federal benefits administration program.
You answer questions strictly from the POLICY context provided. You cite the
section or page number for every fact. If the answer is not in the context,
you say "I don't see that in the document" — you do not guess.
`.trim();

const QUESTION =
  "For Form SSA-1020, what's the deadline a Medicaid recipient has to report a change in income, and what happens if they miss it?";

async function main() {
  const startedAt = Date.now();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `POLICY:\n${POLICY_CONTEXT}\n\nQUESTION:\n${QUESTION}`,
      },
    ],
  });

  const elapsedMs = Date.now() - startedAt;
  const answer = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Token + cost accounting. Sonnet 4.6 pricing: $3/MTok input,
  // $15/MTok output. Update if Anthropic publishes new rates.
  const inputCost = (message.usage.input_tokens / 1_000_000) * 3;
  const outputCost = (message.usage.output_tokens / 1_000_000) * 15;
  const totalCost = inputCost + outputCost;

  console.log("─────────────────────────────────────────────────────");
  console.log("fedbench smoke test");
  console.log("─────────────────────────────────────────────────────");
  console.log(`Model:    ${message.model}`);
  console.log(`Latency:  ${elapsedMs}ms`);
  console.log(`Tokens:   ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`);
  console.log(`Cost:     $${totalCost.toFixed(6)}`);
  console.log("─────────────────────────────────────────────────────");
  console.log("QUESTION:");
  console.log(`  ${QUESTION}`);
  console.log();
  console.log("ANSWER:");
  console.log(answer.split("\n").map((l) => `  ${l}`).join("\n"));
  console.log("─────────────────────────────────────────────────────");
  console.log("✓ Smoke test passed. SDK wired, agent answered.");
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
