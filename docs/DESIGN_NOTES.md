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

## Why hand-written ground truth, not LLM-generated

LLM-generated ground truth contaminates the eval loop. If an LLM writes the "correct" answer, then another LLM is being scored against an LLM's output — not against the document. Drift in either model gets attributed to drift in the system; failure modes that affect both models cancel out invisibly.

Hand-written ground truth is tedious. It's also the only way the eval produces signal that's independent of any model. If 50 hand-written questions take 8 hours to write and verify, that's an 8-hour investment in objective ground truth — small compared to the months of engineering that depend on it.

## Why Bun

The project needs a fast iteration loop. Bun's native TypeScript support eliminates the transpile step; its bundled package manager is faster than npm/pnpm; its bundled test runner removes a Jest/Vitest dependency. For a project that's primarily script-shaped (eval runs, corpus fetchers, smoke tests), Bun's reduced ceremony pays back the choice almost immediately.

Bun's tradeoffs (smaller ecosystem, fewer obscure-package compatibility guarantees) are negligible here because the dependency graph is small and well-known.
