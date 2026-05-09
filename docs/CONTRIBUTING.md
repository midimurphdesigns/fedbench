# Contributing to fedbench

Thanks for considering a contribution. This document explains how to add corpus documents, write evaluation questions, and propose changes.

## Ground rules

- **Public corpus only.** Documents added to the corpus must be public, freely redistributable, and verifiable at the source URL. Cite the URL and a SHA-256 checksum.
- **Hand-written ground truth.** LLM-generated answers are not accepted as ground truth, even with verification. This is a hard rule — it preserves the integrity of the eval signal.
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

The eval set is the most important part of the harness. Bad eval questions produce noisy scores and undermine the entire signal.

A good eval question is:

- **Specific.** Asks about a single fact, not a multi-part essay.
- **Verifiable.** The answer can be located on a specific page and section of the source document.
- **Realistic.** Plausible as a question a real user would ask — caseworker, paralegal, or self-service applicant.

To add a question:

1. Pick a question.
2. Find the answer in the source document. Note the page and section.
3. Write the verified answer in your own words. Include the page and section as a citation.
4. Add 2-4 acceptable alternative phrasings (e.g., "10 days" and "ten calendar days" should both be accepted).
5. Mark `inCorpus: true` if the answer exists in the loaded documents, `false` if the question is designed to test refusal discipline.
6. Add the entry to `eval/questions.json`.

Out-of-corpus questions are ~10-20% of the eval set by design. They're how `fedbench` measures whether the agent refuses to answer when it should.

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
