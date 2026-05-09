# Design notes

Non-obvious decisions and the reasoning behind them. Append-only — when a decision is revisited, add a new entry below the original instead of editing it.

## Why grounded Q&A specifically

The harness targets one shape of LLM workload: an agent that reads a document corpus and answers questions about it. This is narrower than "general-purpose chatbot" and broader than "retrieval API." It's the shape of workload where citation accuracy and refusal discipline are the dominant failure modes — both of which are measurable and underserved by general-purpose eval frameworks.

A harness aimed at "all LLM workloads" would have to either (a) measure the lowest common denominator (latency, cost) or (b) provide unrelated metrics for unrelated tasks. Neither produces actionable signal for any specific deployment. Narrower scope; sharper metrics.

## Why public policy PDFs

Policy and benefits documents are a near-ideal test corpus for grounded Q&A:

1. **Public.** Anyone can fork the repo and reproduce the eval. No proprietary corpus.
2. **Long.** Real policy documents run 50-200+ pages. Short documents trivialize retrieval; long documents stress it.
3. **Precise.** A wrong number in a policy answer is a wrong number, not a stylistic preference. Failure is unambiguous.
4. **Citation-shaped.** Policy documents have natural section and page structure. Citation accuracy can be measured against ground truth without ambiguity.
5. **Domain-relevant.** Document-Q&A is a real production use case for caseworkers, paralegals, healthcare administrators, claims adjusters. The harness measures something with a real-world analog.

## Why Promptfoo

Three open-source eval frameworks were realistic candidates: Promptfoo, DeepEval, and a custom-built layer.

- **Promptfoo:** CI-native, used in production at OpenAI and Anthropic, language-agnostic (configured via YAML), supports custom assertion types.
- **DeepEval:** Python-native (pytest-style assertions). Strong for Python codebases. Adds a Python dependency to a Bun/TS project, which fights the "Bun for everything" rule.
- **Custom:** Maximum control, longest yak-shave. Most of what you'd build is what Promptfoo already does.

Promptfoo wins on integration cost and CI discipline. The custom assertion types it supports are sufficient for citation existence, citation faithfulness, and refusal-discipline scoring.

## Why Phoenix over LangSmith

LangSmith has a stronger brand, but is commercial and tied to a vendor account. Phoenix is open-source, self-hosted, and a fork can run end-to-end on a laptop without any external dependency. The "self-hostable end-to-end" rule is a hard constraint; LangSmith would violate it.

Phoenix is also genuinely good at the things this harness needs: trace export, span-level retrieval inspection, cost dashboards.

## Why Anthropic primary, OpenAI cross-check

Anthropic Claude (Sonnet 4.6) is the current best-in-class for instruction-following on document-grounded tasks — specifically for the refusal-when-unsure behavior. OpenAI GPT-class is the strongest alternative provider; including it as a cross-check eval lets the harness detect single-vendor blind spots (a bug in one provider's instruction handling that the eval would otherwise miss).

The harness is provider-agnostic at the call site; the choice of "primary" is a default, not a structural commitment.

## Why MCP for tool use

The Model Context Protocol is Anthropic's standard for agent tool use, and is being adopted across the broader ecosystem (OpenAI Apps SDK, IDE assistants, etc.). Building the agent's tool layer on MCP means:

- Tool definitions are portable across providers that adopt MCP.
- Standard MCP servers (filesystem, search, etc.) work without custom adapters.
- Future MCP-native models work out of the box.

The cost is a small amount of indirection vs. provider-native tool-use APIs. The benefit is portability.

## Why no frontend / dashboard

Phoenix already has a perfectly good dashboard for traces and span inspection. Building a second one would duplicate effort and create a UI to maintain. The deliverable of `fedbench` is the harness — measurements, methodology, eval discipline — not a visualization layer on top of measurements.

CLI output is structured (JSON, machine-readable). If a user wants visualization, they pipe the output into Phoenix or any other tool that consumes structured eval data.

## Why Bun

The project needs a fast iteration loop. Bun's native TypeScript support eliminates the transpile step; its bundled package manager is faster than npm/pnpm; its bundled test runner removes a Jest/Vitest dependency. For a project that's primarily script-shaped (eval runs, corpus fetchers, smoke tests), Bun's reduced ceremony pays back the choice almost immediately.

Bun's tradeoffs (smaller ecosystem, fewer obscure-package compatibility guarantees) are negligible here because the dependency graph is small and well-known.

## Why BM25 over embeddings (for now)

Retrieval is the part of a RAG pipeline most people reach for embeddings on. We chose BM25 instead, deliberately:

1. **Domain match.** BM25 ranks by literal term overlap, weighted by inverse document frequency. Caseworker queries are short, factual, and dominated by domain vocabulary ("Part B premium", "10 days", "8-month period"). Those queries' relevance signal IS the literal terms, which is exactly what BM25 optimizes for. Embeddings shine on paraphrase-heavy or cross-lingual workloads; benefits-policy queries are neither.

2. **Self-hostable.** BM25 has zero infrastructure dependencies. No embedding API, no vector DB, no async indexing pipeline. The "fork it and run it" property of the harness stays intact.

3. **Defensible default.** When the benchmark harness's job is to measure agent quality, the retrieval layer should be a known, well-understood baseline. BM25 is the standard reference; if dense retrieval beats it, that's measurable and worth doing. Starting with embeddings would mask whether the agent or the retrieval is the failure point.

If real measurements show BM25 hurting end-to-end accuracy on this corpus, the cleanest upgrade is hybrid retrieval (BM25 + a re-ranker on top, or BM25 + dense fusion). That's a v0.2 item, surfaced by the eval, not assumed up front.

## Why a fallback ladder, not a single model

Production AI deployments need a degradation path. The primary model can rate-limit, error, or simply be slow on a given call. A harness with no fallback is a single point of failure pretending to be a measurement.

The ladder encodes the degradation path explicitly:

- **Rung 1 (primary):** Sonnet 4.6. Strongest grounded-Q&A behavior at moderate cost.
- **Rung 2 (fallback):** Haiku 4.5. ~5x cheaper, ~2x faster, lower quality. Acceptable on questions with clear retrieved evidence; flag for sample-audit on close calls.
- **Rung 3 (last resort):** open-weights via OpenRouter. Network-dependent, model-quality-dependent. Stubbed in the spec; not yet implemented because it requires an OpenAI-compatible client setup that adds dependencies. Tracked as a v0.3 item.

The cascade rule is conservative: only true provider-side failures (429, 5xx, network) trigger a rung change. 4xx client errors (other than 429) signal a bug in the harness, not a provider problem, and stop the ladder so the bug isn't masked.

The agent reports which rung answered + any earlier rungs that failed. This provenance is structured: a future analysis can correlate "answers that came from Haiku because Sonnet rate-limited" against eval verdicts and detect whether the fallback rung is degrading quality measurably.

## Why a second domain (OSHA), and what it taught us

v0.3 added a second corpus — three public OSHA workplace-safety publications — alongside the original Medicare one. The point wasn't to broaden the harness's claim ("works on more domains!"); it was to test whether a *single* harness, with the same agent, the same retrieval strategy, the same judge, and the same scoring rules, holds up when the underlying language shape changes.

Medicare publications are prose-heavy benefits policy: long sentences, hedging qualifiers ("most people pay", "in some cases"), dense numeric facts ($202.90 premium, $1,736 deductible, 7-month enrollment window). OSHA publications are procedural: planning checklists, equipment-and-rule statements, ratios ("one warden per every 20 employees"), thresholds ("3 to 4 minutes", "10 or fewer employees"). Different surface, different retrieval signal.

What the side-by-side run actually showed:

- **The harness generalized cleanly.** Medicare 11/11 pairs pass, OSHA 10/10 pairs pass. Same agent, same judge, same scoring gate. Adding a second domain was a config change (`corpus/sources.osha.json`, `eval/questions.osha.jsonl`) and one prompt parameter (`DomainConfig`), not a fork.
- **Layer 1 (deterministic citation-check) is proportionally less load-bearing on procedural domains.** Medicare in-corpus pairs hit 8/8 token-match passes (0 skips). OSHA hit 5/8 token-match passes (3 skips — answers like "one warden per 20 employees" or "10 or fewer employees may communicate the plan orally" don't have the dollar/percent/period tokens the regex extractor looks for, so they defer to the judge).
- **Layer 2 (LLM-as-judge) was cleaner on OSHA than on Medicare.** Medicare: 6/8 faithful + 2/8 partially-faithful (the partials are cases where the agent dropped a hedging qualifier present in the source). OSHA: 8/8 faithful — OSHA's source language is more direct ("must", "shall", "every X"), so there's less hedging to drop.
- **Cost and latency were comparable.** ~$0.024/pair on OSHA vs ~$0.029/pair on Medicare; OSHA's smaller documents produce shorter prompts and slightly faster generations.

The lesson: a one-domain harness lets you show that an eval pipeline *can* run end-to-end. A two-domain harness lets you show that *the same pipeline* responds usefully to different language shapes — and that the per-layer contribution shifts when the domain shifts. That second observation is the one a hiring manager actually wants from an eval engineer.

A v0.4 expansion adding hybrid retrieval would let the harness measure whether OSHA's higher Layer 1 skip rate corresponds to a real retrieval gap. The seam is in (`src/retrieval/index.ts`, `Retriever` interface) but the implementation is deliberately deferred until measurement justifies it.

## Why no LLM-generated ground truth

LLM-generated ground truth contaminates the eval loop. If an LLM writes the "correct" answer, then another LLM is being scored against an LLM's output — not against the document. Drift in either model gets attributed to drift in the system; failure modes that affect both models cancel out invisibly.

Production reality is that ground truth comes from the customer's domain experts (caseworkers, paralegals, claims adjusters), not from the engineer. The engineer's job is to build the harness that consumes their ground truth, not author it. The contributing rule for fedbench mirrors that: provenance on every pair (`verifiedBy: "domain-expert" | "author@source-pdf" | "sample-audit" | "methodology-review"`), and the layered eval (deterministic citation check + LLM-as-judge) catches drift in the ground truth itself on every run. A wrong page number in the ground truth fails loud the first time the eval runs.
