# fedbench

> Evaluation harness for grounded LLM Q&A over policy and benefits PDFs. Measures hallucination, citation accuracy, and refusal discipline as first-class metrics.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## The problem

LLM agents that answer questions over a document corpus fail in three distinctive ways:

1. **Hallucinated citations.** The agent invents a page or section number that doesn't exist in the source document.
2. **Confident wrong answers.** The agent paraphrases the document but distorts a numeric threshold, deadline, or eligibility criterion.
3. **Failure to refuse.** When the answer isn't in the document, the agent guesses instead of saying "I don't see that here."

These failures are invisible during demo testing and visible only at scale, in the hands of users who can't easily check the source. `fedbench` makes them measurable.

## What it does

Given a corpus of public policy PDFs (Social Security program guides, Medicare publications, state benefits handbooks, etc.) and a set of verified ground-truth Q&A pairs, `fedbench` runs a grounded-Q&A agent against the corpus and produces structured metrics on three axes:

- **Citation accuracy.** Does every factual claim cite a real page/section that contains the claim?
- **Refusal discipline.** When the answer isn't in the corpus, does the agent refuse instead of guessing?
- **Cost and latency.** Token spend per query, p50/p95 latency, viability of cheaper fallback models.

The harness is provider-agnostic at the call site, MCP-based for tool use, and self-hosted end-to-end (no SaaS account required to fork and run).

## Stack

| Layer                | Choice                                                                | Why                                                                          |
| -------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Runtime              | [Bun](https://bun.com)                                                | Fast, native TypeScript, no transpile step                                   |
| Language             | TypeScript (strict)                                                   | Type discipline carries through to prompt and eval schemas                   |
| Primary LLM          | Anthropic Claude (Sonnet 4.6)                                         | Strong instruction-following and citation grounding                          |
| Fallback LLM         | Anthropic Claude (Haiku 4.5)                                          | ~5× cheaper, ~2× faster — viable for non-critical paths                      |
| Cross-check LLM      | OpenAI GPT-class                                                      | Independent provider for cross-evaluation; detects single-vendor blind spots |
| Tool protocol        | [MCP](https://modelcontextprotocol.io/)                               | Anthropic-introduced standard for agent tool use                             |
| Eval framework       | [Promptfoo](https://github.com/promptfoo/promptfoo)                   | CI-native LLM evaluation; used in production at OpenAI and Anthropic         |
| Trace observability  | [Arize Phoenix](https://github.com/Arize-ai/phoenix)                  | Open-source, self-hosted LLM trace observability                             |
| RAG retrieval        | TBD                                                                   | Likely pgvector locally; faiss optional                                      |

## Getting started

```bash
# Install dependencies
bun install

# Configure your API keys
cp .env.example .env
# edit .env — at minimum, set ANTHROPIC_API_KEY

# Fetch the corpus (public federal benefits PDFs, checksum-verified)
bun run corpus:fetch

# Build the chunk index for retrieval
bun run corpus:chunk

# Run the smoke test against the Anthropic API
bun run smoke

# Run the full evaluation suite (agent + retrieval + judge)
bun run eval
```

## Corpus

The corpus is three public-domain federal benefits publications, defined in [`corpus/sources.json`](./corpus/sources.json). Documents are works of the US federal government and not subject to copyright (17 USC §105). Each entry pins a URL and a SHA-256 checksum so a fork can verify it received exactly the same bytes the eval was run against.

The fetcher (`bun run corpus:fetch`) is idempotent: a file already on disk with the right checksum is left alone. If a publisher updates a document, the checksum mismatch fails loud rather than silently changing the eval baseline.

## Documentation

Project docs live in [`docs/`](./docs):

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system design and module boundaries
- [`docs/EVAL_METHODOLOGY.md`](./docs/EVAL_METHODOLOGY.md) — how citation accuracy, refusal discipline, and cost are measured
- [`docs/DESIGN_NOTES.md`](./docs/DESIGN_NOTES.md) — non-obvious decisions and the reasoning behind them
- [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) — how to add a new corpus, write evals, propose changes

## Project status

End-to-end eval pipeline is working. The agent retrieves chunks via BM25, prompts Claude through a fallback ladder (Sonnet 4.6 primary → Haiku 4.5 fallback) with strict citation rules, and produces grounded answers. The harness scores those answers through two layers: deterministic citation-existence checks against the parsed corpus, and Claude Opus 4.7 as the LLM-as-judge for citation faithfulness. Refusal discipline is checked separately on out-of-corpus questions.

Current measurements against the v0.1 eval set (11 pairs: 8 in-corpus + 3 out-of-corpus):

- **Citation accuracy:** 8/8 in-corpus answers cite a real, verifiable page
- **Citation faithfulness:** 6 faithful + 2 partially-faithful (judge flagged minor omitted qualifiers) + 0 unfaithful
- **Refusal discipline:** 3/3 OOC questions correctly refused; 0/8 false refusals on in-corpus questions
- **Cost:** ~$0.029 per pair end-to-end (agent ~$0.010 + judge ~$0.019)
- **Latency:** agent p50 1.9s, p95 3.9s

The agent reports which fallback rung produced each answer, with full provenance for any earlier rungs that failed. CI runs typecheck and unit tests on every push (44 tests, ~177ms). The full eval suite is runnable locally and on manual workflow_dispatch.

Known limits: the third fallback rung (open-weights via OpenRouter) is documented in [`docs/DESIGN_NOTES.md`](./docs/DESIGN_NOTES.md) but not yet wired (v0.3). The judge currently flags "partially-faithful" for cases where the agent's stated facts are correct but it omitted a hedging qualifier ("most people pay" / "may pay"); a future judge prompt should distinguish "wrong fact" from "omitted hedge" and weight them differently.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full module breakdown.

## Companion project

[`fieldops-mcp`](https://github.com/midimurphdesigns/fieldops-mcp) is the sibling artifact: an MCP server that exposes a small-business field-services workflow as agent tools. fedbench measures *whether the model is right*; fieldops-mcp shapes *what the model can do*.

## License

MIT — see [`LICENSE`](./LICENSE).

## Author

Kevin Murphy
[kevinmurphywebdev.com](https://kevinmurphywebdev.com) · [GitHub](https://github.com/midimurphdesigns) · [LinkedIn](https://www.linkedin.com/in/midimurphdesigns)
