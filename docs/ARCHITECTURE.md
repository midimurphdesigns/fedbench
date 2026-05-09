# Architecture

System design and module boundaries for `fedbench`.

## Top-level

```
fedbench/
├── src/
│   ├── smoke.ts            # End-to-end sanity check; one Claude call against a stub policy snippet
│   ├── agent/              # Grounded-Q&A agent, fallback ladder, domain-config plumbing
│   ├── corpus/             # Source PDFs, fetcher, chunker, multi-corpus path resolution
│   ├── retrieval/          # Retriever interface, BM25 implementation, hybrid stub
│   ├── eval/               # Eval runner, ground-truth Q&A pairs, judge, citation-check
│   └── obs/                # (planned) trace export, cost accounting, metric aggregation
├── scripts/
│   └── parse-pdfs.py       # pypdf step that turns fetched PDFs into per-page text
├── corpus/
│   ├── sources.json        # Medicare manifest (legacy single-corpus layout)
│   ├── sources.osha.json   # OSHA manifest (namespaced multi-corpus layout)
│   └── raw/                # fetched PDFs (gitignored; per-corpus subdirs)
├── eval/
│   ├── questions.jsonl     # Medicare ground-truth Q&A pairs
│   └── questions.osha.jsonl # OSHA ground-truth Q&A pairs
└── docs/                   # Project documentation (this folder)
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

Owns the PDF source list, fetcher (with checksum verification), parser, chunker, and the multi-corpus path resolver. The corpus is built reproducibly: anyone forking the repo runs `bun run corpus:fetch` and gets the same documents.

Each corpus has a manifest pinning every document's URL and SHA-256 checksum, plus a short description of its scope. The fetcher refuses to accept any file whose hash does not match the manifest; an upstream document change fails loud and forces a deliberate manifest update rather than silently shifting the eval baseline.

**Multi-corpus path layout** — fedbench supports multiple side-by-side corpora behind a single `--corpus <id>` flag. The router lives in `src/corpus/paths.ts`:

```
corpus/sources.<id>.json          # manifest (URL + sha256 + scope)
corpus/raw/<id>/<doc>.pdf         # fetched PDFs (gitignored)
.corpus-cache/<id>/<doc>.txt      # pypdf-parsed text per page
.corpus-cache/<id>/chunks.jsonl   # chunked passages for retrieval
eval/questions.<id>.jsonl         # verified Q&A pairs
```

The Medicare layout (the v0.2 single-corpus shape) is preserved as a legacy lane: `corpus/sources.json`, `corpus/raw/<doc>.pdf`, `.corpus-cache/<doc>.txt`, `eval/questions.jsonl`. New corpora always use the namespaced layout.

A small process-wide active-corpus state (`activateCorpus(id)`, `getActiveCorpusPaths()`) is shared by the BM25 retriever, the deterministic citation-check, and the LLM-as-judge so they all read from the same lane the eval runner picked.

Citation index maps every chunk back to a source document and page, so retrieved evidence can be cited back to a verifiable location. Section-heading mapping is on the roadmap; v0.3 cites at page granularity.

### `src/retrieval/`

Owns the `Retriever` interface, the BM25 implementation, and a hybrid-retrieval stub. Defining a `Retriever` interface separately from BM25 means a future eval can run the same agent against multiple retrievers and let the harness *measure* which one wins on a given domain — that comparison is the actual FDE skill, not "I picked the right retriever up front."

v0.3 ships:
- `bm25Retriever` (zero-dep BM25, the production implementation)
- `hybridRetriever` (stub that currently delegates to BM25; intended shape documented in the source for when measurement justifies building it out)

No vector database, no embedding API. Retrieval is keyword-only because the corpus queries are short, factual, and dominated by literal vocabulary — the failure mode embeddings solve for (paraphrase / cross-lingual) is not the failure mode this domain has. See `docs/DESIGN_NOTES.md` for the empirical case.

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
