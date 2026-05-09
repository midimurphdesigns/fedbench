# CLAUDE.md

Project guide for AI coding assistants. Read this before writing code in this repo.

## Project

`fedbench` is an evaluation harness for grounded LLM Q&A over policy and benefits PDFs. It measures hallucination, citation accuracy, and refusal discipline as first-class metrics — the failure modes that matter for document-Q&A agents in production.

The full project context — scope, design decisions, eval methodology, contribution guide — lives in [`docs/`](./docs):

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system design and module boundaries
- [`docs/EVAL_METHODOLOGY.md`](./docs/EVAL_METHODOLOGY.md) — how citation accuracy, refusal discipline, and cost are measured
- [`docs/DESIGN_NOTES.md`](./docs/DESIGN_NOTES.md) — non-obvious decisions and the reasoning behind them
- [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) — how to add a new corpus, write evals, propose changes

Always read those before proposing structural changes.

## Engineering rules

- **TypeScript strict mode.** No `any`. Use `type` over `interface` for object shapes. Errors are typed.
- **Open source dependencies only.** No SaaS lock-in. Anything the harness depends on must be self-hostable so anyone can fork and run.
- **Every feature has an eval.** A new prompt, a new agent capability, a new retriever — none of these ship without a corresponding eval that measures whether they regress prior behavior.
- **Cost accounting is real.** Every model call gets logged with token counts and dollar cost. No "looks fast" — actual numbers.
- **Public corpus only.** Documents in the corpus must be public, freely redistributable, and verifiable at the source. Cite the URL and a checksum.
- **Refusal is a feature, not a fallback.** When the answer isn't in the document, the agent must say so. This behavior is measured as `refusal discipline` and gated in CI.

## Code quality

- Code is documentation; well-named identifiers replace most comments. Comments explain *why*, never *what*.
- No premature abstraction. Three providers does not justify a `ProviderFactory`.
- No marketing prose in code or in the README. Write what the thing does, not how impressive it is.
- Errors are typed and handled at boundaries. Don't swallow errors silently.

## Stack

Use Bun for everything: runtime, package manager, test runner, scripts.

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of `jest` or `vitest`
- `bun install` instead of `npm install` / `yarn` / `pnpm`
- `bun run <script>` instead of `npm run <script>`
- `bunx <package>` instead of `npx <package>`
- Bun loads `.env` automatically; no `dotenv` import.

### Bun APIs to prefer

- `Bun.file` over `node:fs` for read/write.
- `Bun.serve()` over `express` for HTTP.
- `bun:sqlite` over `better-sqlite3`.
- `Bun.sql` over `pg` / `postgres.js`.
- `Bun.$\`cmd\`` over `execa`.
- Built-in `WebSocket` over `ws`.

### Testing

```ts
import { test, expect } from "bun:test";

test("hello", () => {
  expect(1).toBe(1);
});
```

Unit tests use `bun test`. Eval-suite testing uses Promptfoo with CI-gated thresholds; see [`docs/EVAL_METHODOLOGY.md`](./docs/EVAL_METHODOLOGY.md).

## Commit style

- Conventional: `feat:`, `fix:`, `eval:`, `corpus:`, `docs:`, `chore:`, `perf:`.
- One conceptual change per commit.
- Commit messages explain *why* the change was made, not *what* changed (the diff shows what).
