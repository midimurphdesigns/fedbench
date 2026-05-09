# Contributing to fedbench

Thanks for considering a contribution. This document explains how to add corpus documents, write evaluation questions, and propose changes.

## Ground rules

- **Public corpus only.** Documents added to the corpus must be public, freely redistributable, and verifiable at the source URL. Cite the URL and a SHA-256 checksum.
- **Provenance on every ground-truth pair.** Each entry in `eval/questions.jsonl` must carry a `verifiedBy` field documenting how it was verified — whether by a domain expert, by sample-audit against the source PDF, or by methodology-level review (for OOC pairs). Pairs without provenance are not scored against.
- **No new dependencies without justification.** Every dependency added must be defended in the PR description: what does it do that the existing stack can't? Is it open source? Self-hostable?
- **TypeScript strict mode.** No `any`. No type assertions to bypass the type system. Errors are typed.

## Adding a corpus document

A corpus document is a public PDF that the eval suite can run questions against.

1. Pick a public document. Examples: SSA program manuals, Medicare publications, IRS publications, state-level benefits handbooks. The document must be linkable at a stable URL and freely redistributable.
2. Compute a SHA-256 checksum of the PDF.
3. Add an entry to `corpus/sources.json` with the URL, checksum, document title, and a short description.
4. Run `bun run corpus:fetch` to download and cache the document locally. The fetcher verifies the checksum before accepting the file.
5. Run `bun run corpus:parse` to chunk the document and build the citation index.
6. Open a PR. Include the source URL and a one-line summary of what's in the document.

## Writing eval questions

The eval set is the calibration tool for everything else the harness does. Bad eval questions produce noisy scores and undermine the entire signal.

A good eval question is:

- **Specific.** Asks about a single fact, not a multi-part essay.
- **Verifiable.** The answer can be located on a specific page and section of the source document.
- **Realistic.** Plausible as a question a real user would ask — caseworker, paralegal, or self-service applicant.

### Adding an in-corpus question

1. Pick a question.
2. Find the answer in the source document. Note the page and section.
3. Write the answer with the page citation.
4. Add 2-4 acceptable alternative phrasings (e.g., "10 days" and "ten calendar days" should both be accepted).
5. Mark `inCorpus: true`.
6. Set `verifiedBy` to one of: `"domain-expert"` (a SME signed off), `"author@source-pdf"` (the contributor verified against the PDF directly), or `"sample-audit"` (verified as part of an audit pass; cite the audit run).
7. Add the entry to `eval/questions.jsonl`.

The harness's deterministic citation-existence check (`src/eval/citation-check.ts`) automatically validates every ground-truth pair on every eval run. A wrong page number in the ground truth fails loud the first time — so don't worry about catching every typo by hand; the harness catches them for you.

### Adding an out-of-corpus question

OOC questions test refusal discipline — the agent should refuse to answer when the answer isn't in the corpus. Verification for these is methodological, not per-pair:

1. Pick a question whose topic is structurally outside the loaded corpus (state Medicaid, VA benefits, weather, taxes, etc.).
2. Mark `inCorpus: false`.
3. Set `verifiedBy: "methodology-review"` with a one-line note explaining why the topic is OOC.
4. Add the entry to `eval/questions.jsonl`.

OOC questions are ~10-20% of the eval set by design. The harness measures refusal-rate on OOC and false-refusal-rate on in-corpus separately.

### Why we don't require a single human to grade every pair

Production AI systems are evaluated against thousands of pairs, not dozens. A methodology that requires a human to hand-grade every pair doesn't scale and doesn't reflect how AI ships in practice. `fedbench` uses a layered approach:

- **Layer 1: deterministic checks** for what code can verify (citation existence, refusal detection, format conformance).
- **Layer 2: LLM-as-judge** with a stronger model for what code can't (citation faithfulness, semantic answer accuracy).
- **Layer 3: human sample-audit** on the small slice the judge is uncertain about (low-confidence rationales, cross-judge disagreements, regressions).

See [`docs/EVAL_METHODOLOGY.md`](./EVAL_METHODOLOGY.md) for the full breakdown.

The contributor's job is to provide good questions and reasonable ground-truth answers. The harness handles validation.

## Proposing changes to scoring

The eval methodology (`docs/EVAL_METHODOLOGY.md`) defines the metrics and thresholds. Changes to scoring change the meaning of every prior eval run, so they require explicit review.

If you're proposing a new metric or a threshold change:

1. Open an issue first describing the change and the failure mode it's designed to catch.
2. Include before/after numbers from running the existing eval set under both the current and proposed scoring.
3. Update `docs/EVAL_METHODOLOGY.md` in the same PR as the implementation.

## Code style

- File names are `kebab-case.ts`.
- Module exports are named (no default exports) so imports are greppable.
- Functions are short. If a function is over ~50 lines, extract.
- Comments explain *why*, not *what*. Well-named code is the documentation.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `eval:`, `corpus:`, `docs:`, `chore:`, `perf:`. One conceptual change per commit.

## Running tests

```bash
bun test                  # unit tests
bun run smoke             # one-call provider smoke test (requires ANTHROPIC_API_KEY)
bun run eval              # full eval suite
bun run typecheck         # strict TypeScript validation
```

## Reporting issues

Open a GitHub issue. Include:

- A minimal reproduction (which corpus, which question, which model)
- Expected vs. actual behavior
- Environment (Bun version, OS)

Issues that include a failing test case are vastly more likely to be fixed quickly than issues that don't.
