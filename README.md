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

# Run the smoke test
bun run smoke

# (Coming soon) Run the full evaluation suite
# bun run eval
```

## Documentation

Project docs live in [`docs/`](./docs):

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system design and module boundaries
- [`docs/EVAL_METHODOLOGY.md`](./docs/EVAL_METHODOLOGY.md) — how citation accuracy, refusal discipline, and cost are measured
- [`docs/DESIGN_NOTES.md`](./docs/DESIGN_NOTES.md) — non-obvious decisions and the reasoning behind them
- [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) — how to add a new corpus, write evals, propose changes

## Project status

This is an active in-progress project. The smoke test is wired and verified end-to-end against the Anthropic API; the eval suite, RAG pipeline, and corpus are being built up incrementally. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full module breakdown and what exists today.

## License

MIT — see [`LICENSE`](./LICENSE).

## Author

Kevin Murphy
[kevinmurphywebdev.com](https://kevinmurphywebdev.com) · [GitHub](https://github.com/midimurphdesigns) · [LinkedIn](https://www.linkedin.com/in/midimurphdesigns)
