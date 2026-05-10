# fedbench

> Evaluation harness for grounded LLM Q&A over policy and benefits PDFs. Measures hallucination, citation accuracy, and refusal discipline as first-class metrics.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** [fedbench.kevinmurphywebdev.com](https://fedbench.kevinmurphywebdev.com) — replay viewer over the 21 verified Q&A pairs, no signup or keys.

## The problem

LLM agents that answer questions over a document corpus fail in three distinctive ways:

1. **Hallucinated citations.** The agent invents a page or section number that doesn't exist in the source document.
2. **Confident wrong answers.** The agent paraphrases the document but distorts a numeric threshold, deadline, or eligibility criterion.
3. **Failure to refuse.** When the answer isn't in the document, the agent guesses instead of saying "I don't see that here."

These failures are invisible during demo testing and visible only at scale, in the hands of users who can't easily check the source. `fedbench` makes them measurable.

## What it does

Given a corpus of public policy PDFs and a set of verified ground-truth Q&A pairs, `fedbench` runs a grounded-Q&A agent against the corpus and produces structured metrics on three axes:

- **Citation accuracy.** Does every factual claim cite a real page that contains the claim? Checked deterministically — the agent's claimed citation has to match an actual chunk of the parsed corpus.
- **Citation faithfulness.** Even if the page exists, does it actually support the answer? A stronger model (Opus 4.7) judges the agent's output against the cited evidence — never the same model grading itself.
- **Refusal discipline.** When the answer isn't in the corpus, does the agent refuse or fabricate? Tested with a held-out set of out-of-corpus questions.

Cost in dollars and tokens, p50/p95 latency, and which rung of the fallback ladder produced each answer are first-class outputs alongside correctness.

The harness ships with two side-by-side public corpora (Medicare and OSHA) so the comparison "same agent, different domain language shape" is built in. Adding your own corpus is a config change. Self-hosted end-to-end — no SaaS account required to fork and run.

## Stack

| Layer               | Choice                                                              | Why                                                                                              |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Runtime             | [Bun](https://bun.com)                                              | Fast, native TypeScript, no transpile step                                                       |
| Language            | TypeScript (strict)                                                 | Type discipline carries through to prompt and eval schemas                                       |
| Agent LLM (primary) | Anthropic Claude (Sonnet 4.6)                                       | Strong instruction-following and citation grounding                                              |
| Agent LLM (fallback)| Anthropic Claude (Haiku 4.5)                                        | ~5× cheaper, ~2× faster — viable when primary rate-limits or errors                              |
| Judge LLM           | Anthropic Claude (Opus 4.7)                                         | Stronger model than the agent — never the same model grading itself                              |
| PDF parser          | [pypdf](https://pypi.org/project/pypdf/)                            | One-shot text extraction during corpus setup; not in the eval hot path                           |
| Retrieval           | BM25 (zero-dep, in-repo)                                            | Short factual queries are dominated by literal vocabulary — the failure mode embeddings solve for is not the failure mode this domain has |
| Test runner         | `bun:test`                                                          | Bundled with Bun; no Jest/Vitest dependency                                                      |
| CI                  | GitHub Actions                                                      | Typecheck + unit tests on every push; full eval is workflow_dispatch only                        |

## Getting started

### Demo it in 30 seconds (no API key required)

```bash
git clone https://github.com/midimurphdesigns/fedbench.git
cd fedbench
bun install

# Replay the eval against recorded agent + judge outputs.
bun run eval:replay --corpus medicare
bun run eval:replay --corpus osha
```

Each replay finishes in well under a second and prints the same per-pair report, comparison numbers, and pass/fail verdict as a live run. The recordings live at [`eval/recordings/`](./eval/recordings/) and were captured by running the live eval against this repo's exact codebase. They're versioned alongside the eval set, so a Q&A change that hasn't been re-recorded fails loudly rather than silently producing wrong numbers.

### Run it for real (Anthropic API key required)

```bash
# Configure your API key
cp .env.example .env
# edit .env — set ANTHROPIC_API_KEY

# Fetch the corpus (public federal PDFs, checksum-verified)
bun run corpus:fetch

# Parse the PDFs into per-page text (needs python3 + pip install pypdf)
bun run corpus:parse

# Build the chunk index for retrieval
bun run corpus:chunk

# Sanity-check the API connection
bun run smoke

# Run the full evaluation suite (agent + retrieval + judge)
bun run eval
```

To run on OSHA instead of Medicare, append `--corpus osha` to each of the four steps. Adding your own corpus is documented below.

To capture a new recording for the no-key demo path, run `bun run eval:record --corpus <id>` — that's the live eval plus a JSONL dump.

## Corpora

fedbench ships with two public-domain federal corpora, both works of the US federal government and not subject to copyright (17 USC §105):

- **Medicare** (default) — three CMS publications: the *Medicare & You* handbook, *Your Medicare Benefits*, and *Your Guide to Medicare Prescription Drug Coverage*. Defined in [`corpus/sources.json`](./corpus/sources.json). Prose-heavy benefits-policy language, dense numeric facts.
- **OSHA** — three OSHA workplace-safety publications: *Personal Protective Equipment* (3151), *How to Plan for Workplace Emergencies and Evacuations* (3088), and *Medical Screening and Surveillance Requirements in OSHA Standards* (3162). Defined in [`corpus/sources.osha.json`](./corpus/sources.osha.json). Procedural language, planning checklists, equipment-and-rule statements.

Each manifest entry pins a URL and a SHA-256 checksum so a fork can verify it received exactly the same bytes the eval was run against. The fetcher (`bun run corpus:fetch [--corpus <id>]`) is idempotent: a file already on disk with the right checksum is left alone. If a publisher updates a document, the checksum mismatch fails loud rather than silently changing the eval baseline.

### Adding your own corpus

1. Drop a manifest at `corpus/sources.<id>.json` with the same shape as the existing ones (URL + SHA-256 + scope per document).
2. Author a Q&A set at `eval/questions.<id>.jsonl`. Verify each citation against the source — the convention is `verifiedBy: "<your-handle>@source-pdf"`.
3. Add a `DomainConfig` entry to `src/agent/domain.ts` so the system prompt's domain-flavored language matches.
4. Run the four steps above with `--corpus <id>`.

Both shipped corpora live in the repo as fully-worked references.

## Documentation

Project docs live in [`docs/`](./docs):

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system design and module boundaries
- [`docs/EVAL_METHODOLOGY.md`](./docs/EVAL_METHODOLOGY.md) — how citation accuracy, refusal discipline, and cost are measured
- [`docs/DESIGN_NOTES.md`](./docs/DESIGN_NOTES.md) — non-obvious decisions and the reasoning behind them
- [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) — how to add a new corpus, write evals, propose changes

## Project status

End-to-end eval pipeline is working across two domains. The agent retrieves chunks via BM25, prompts Claude through a fallback ladder (Sonnet 4.6 primary → Haiku 4.5 fallback) with strict citation rules, and produces grounded answers. The harness scores those answers through two layers: deterministic citation-existence checks against the parsed corpus, and Claude Opus 4.7 as the LLM-as-judge for citation faithfulness. Refusal discipline is checked separately on out-of-corpus questions.

### v0.3 measurements (Medicare vs OSHA, same agent + same judge + same scoring rules)

| Metric                          | Medicare (11 pairs) | OSHA (10 pairs)    |
| ------------------------------- | ------------------- | ------------------ |
| In-corpus citation pass         | 8/8                 | 5/8                |
| In-corpus citation skip         | 0/8                 | 3/8                |
| Judge: faithful                 | 6/8                 | 8/8                |
| Judge: partially-faithful       | 2/8                 | 0/8                |
| Judge: unfaithful               | 0/8                 | 0/8                |
| OOC refusal rate                | 3/3                 | 2/2                |
| In-corpus false refusal rate    | 0/8                 | 0/8                |
| Cost per pair (agent + judge)   | ~$0.029             | ~$0.024            |
| Agent latency p50 / p95         | 2159ms / 4191ms     | 2044ms / 2453ms    |
| Eval verdict                    | 11/11 pairs pass    | 10/10 pairs pass   |

The Medicare-vs-OSHA skip-rate gap (0% vs 37.5% for Layer 1 deterministic citation-check) is the empirical "different domain shape, different signal" story: number-dense Medicare answers lean on Layer 1; procedural OSHA answers ("one warden per 20 employees", "10 or fewer employees may communicate orally") have less for the regex extractor to grab and defer to Layer 2's LLM judge instead. Both layers earn their keep — neither alone would catch what the other does. See [`docs/DESIGN_NOTES.md`](./docs/DESIGN_NOTES.md) for the full discussion.

The agent reports which fallback rung produced each answer, with full provenance for any earlier rungs that failed. CI runs typecheck and unit tests on every push (72 tests, ~180ms). The full eval suite is runnable locally and on manual workflow_dispatch.

### Known limits

- The third fallback rung (open-weights via OpenRouter) is documented in [`docs/DESIGN_NOTES.md`](./docs/DESIGN_NOTES.md) but not yet wired.
- The hybrid retriever (`src/retrieval/hybrid.ts`) ships as a structural seam only — it currently delegates to BM25. A real BM25-plus-lexical-rerank pipeline is a v0.4+ item, deliberately not built speculatively until measurement justifies it.
- The judge currently flags "partially-faithful" for cases where the agent's stated facts are correct but it omitted a hedging qualifier ("most people pay" / "may pay"); a future judge prompt should distinguish "wrong fact" from "omitted hedge" and weight them differently.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full module breakdown.

## Companion project

[`fieldops-mcp`](https://github.com/midimurphdesigns/fieldops-mcp) is the sibling artifact: an MCP server that exposes a small-business field-services workflow as agent tools. fedbench measures *whether the model is right*; fieldops-mcp shapes *what the model can do*.

## License

MIT — see [`LICENSE`](./LICENSE).

## Author

Kevin Murphy
[kevinmurphywebdev.com](https://kevinmurphywebdev.com) · [GitHub](https://github.com/midimurphdesigns) · [LinkedIn](https://www.linkedin.com/in/midimurphdesigns)
