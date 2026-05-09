# Architecture

System design and module boundaries for `fedbench`.

## Top-level

```
fedbench/
├── src/
│   ├── smoke.ts            # End-to-end sanity check; one Claude call against a stub policy snippet
│   ├── agent/              # Provider adapters, MCP tool wiring, fallback ladder logic
│   ├── corpus/             # Source PDFs, fetcher script, parser, chunker, citation index
│   ├── retrieval/          # Embedding, retrieval, page-grounding
│   ├── eval/               # Eval harness, ground-truth Q&A pairs, judge models, scoring
│   └── obs/                # Trace export to Phoenix, cost accounting, metrics aggregation
├── docs/                   # Project documentation (this folder)
└── promptfooconfig.yaml    # Eval suite configuration
```

The agent, corpus, retrieval, eval, and obs modules are each independently testable and replaceable. The agent doesn't know how the corpus was assembled; the eval doesn't know which model is primary. Boundaries are crossed only through typed contracts.

## Data flow

```
[ Public PDFs ]
       │  (corpus/fetch.ts — download + checksum + cache)
       ▼
[ Parsed chunks + citation index ]
       │  (retrieval/index.ts — embed + persist)
       ▼
[ Searchable retrieval store ]
       │  (agent/answer.ts — retrieve relevant chunks)
       ▼
[ Grounded prompt sent to LLM ]
       │  (agent/providers.ts — primary → fallback ladder)
       ▼
[ Answer + structured trace ]
       │  (obs/trace.ts — emit to Phoenix; cost-account)
       ▼
[ Eval scoring against ground truth ]
       │  (eval/score.ts — citation accuracy, refusal discipline, faithfulness)
       ▼
[ CI verdict: pass / fail / regression ]
```

## Module responsibilities

### `src/agent/`

Owns the prompt template, the system prompt, the call-site provider abstraction, and the fallback ladder. Provider adapters (Anthropic, OpenAI, OpenRouter) are swappable behind a single typed interface. The fallback ladder is explicit: primary model → cheaper model → open-weights model, with documented degradation criteria (e.g., "if latency p95 > 800ms, drop to Haiku").

### `src/corpus/`

Owns the PDF source list, fetcher (with checksum verification), parser, and chunker. The corpus is built reproducibly: anyone forking the repo runs `bun run corpus:fetch` and gets the same documents. Citation index maps every chunk to a source page and section so retrieved evidence can be cited back to a verifiable location.

### `src/retrieval/`

Owns embedding, vector storage, and retrieval. Storage is local (pgvector or sqlite-vss) so the harness runs offline. Retrieval returns chunks with their citation metadata attached.

### `src/eval/`

Owns ground-truth Q&A pairs, judge-model orchestration, and scoring logic. Ground-truth is hand-written and version-controlled; LLM-generated ground truth is explicitly forbidden. Scoring runs through Promptfoo with custom assertion types for citation accuracy and refusal discipline.

### `src/obs/`

Owns trace export, cost accounting, and metric aggregation. Traces export to a self-hosted Phoenix instance. Cost is computed per-call in dollars based on a versioned price table.

## Concurrency model

Eval runs are parallelized at the question level (one in-flight call per question, bounded by an explicit concurrency limit). Within a single question, the agent is sequential (retrieve → prompt → score). No background workers; no message queues. The harness is a CLI tool, not a service.

## Testability

- Unit tests (`bun test`) cover pure functions: chunkers, citation parsers, scorers, fallback-ladder logic.
- Eval tests (Promptfoo) cover end-to-end behavior against the corpus.
- Integration tests cover provider adapters using recorded fixtures, not live API calls.
- The smoke test (`bun run smoke`) is the only test that hits a real provider, used to verify SDK wiring.
