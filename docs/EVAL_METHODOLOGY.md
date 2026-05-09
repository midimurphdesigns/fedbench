# Evaluation methodology

How `fedbench` measures the failure modes of grounded document Q&A — and how it scales beyond what a human can manually verify.

## Design principle

Production AI systems are evaluated against tens of thousands of questions, not dozens. A methodology that requires a human to hand-grade every output is a methodology that doesn't scale, and therefore doesn't reflect how AI ships in practice. `fedbench` uses a layered approach: deterministic checks for what code can verify, LLM-as-judge for what code can't, and human sample-audit only on the small slice where the judge itself is uncertain.

## What we measure

Three first-class metrics. Each one is a numeric score per question; aggregates roll up across the eval set.

### 1. Citation accuracy

For every factual claim in the agent's answer, does it cite a real page or section in the source document, and does that page or section actually contain the claim?

Scored on two sub-axes:

- **Citation existence.** The cited page/section exists in the document. Verified deterministically by code (`src/eval/citation-check.ts`) — parse the citation, look it up against the parsed corpus, return boolean. No model needed.
- **Citation faithfulness.** The cited location actually supports the claim. Scored by an LLM-as-judge given the agent's claim AND the cited chunk as evidence; the judge returns `faithful` / `partially-faithful` / `unfaithful` with a one-line reason.

Failure modes caught:
- Made-up section numbers (caught by existence check)
- Real section numbers that don't actually contain the claimed fact (caught by faithfulness judge)
- Claims that combine information from multiple sections without citing both (caught by faithfulness judge)

### 2. Refusal discipline

When the answer is *not* in the document, does the agent say so?

The eval set includes a designated subset of "out-of-corpus" questions — questions whose answers do not exist anywhere in the loaded documents. For each, the metric is:

- **Refusal rate** on out-of-corpus questions: ideally 100%.
- **False-refusal rate** on in-corpus questions: should be ~0%. The agent shouldn't refuse questions it could answer correctly.

Refusal is detected programmatically by string-matching the response against a refusal-pattern set (`I don't see that`, `not in the document`, `I don't have information`, etc.). String matching is deterministic and unambiguous; no judge needed.

Failure modes caught:
- Agent fabricates an answer rather than admit ignorance
- Agent fabricates a citation for an answer it didn't actually find
- Agent over-refuses, giving up on answerable questions

### 3. Cost and latency

Per-call:
- Input tokens, output tokens
- Dollar cost (computed from a versioned price table per model)
- Wall-clock latency

Aggregated:
- p50, p95, p99 latency
- Mean and median cost per question
- Cost-per-question by model (so the fallback ladder can be evaluated quantitatively)

This isn't optional telemetry. It runs on every eval pass and is reported in the eval output. Inference economics are a first-class concern.

## How we score (the layered approach)

### Layer 1: deterministic checks (free, instant, reliable)

What code can verify, code verifies. No LLM in the loop:

- **Citation existence.** Parse the agent's claimed citation, look up the page/section in the parsed corpus, assert the cited text matches at the byte level (or close-enough fuzzy match).
- **Refusal detection.** String-match the response against the refusal-pattern set.
- **Format conformance.** Did the agent output the expected schema? Was the answer length within bounds?

Layer 1 catches the most common and most embarrassing failure modes (made-up citations, hallucinated section numbers) without any inference cost.

### Layer 2: LLM-as-judge (cheap, scales, almost-as-reliable)

What code can't verify, a stronger model judges. The judge:

- Receives the agent's answer, the cited chunk from the source, and the rubric.
- Returns a categorical score (`faithful` / `partially-faithful` / `unfaithful`) plus a one-line rationale.
- Runs on a stronger model than the agent under test (e.g., judge with Opus, score Sonnet 4.6 outputs). This avoids the "model judges itself" failure mode.
- Costs ~$0.005 per pair at Opus rates. 1,000 pairs costs ~$5 per eval run.

The judge prompt is versioned in the eval config alongside the rubric. Changing the judge or rubric changes the score baseline; the change is explicit and reviewable.

### Layer 3: human sample-audit (rare, targeted)

A human reviewer is loaded into the loop only when:

- The judge's rationale is short or low-confidence ("the chunk doesn't clearly support or contradict")
- Two judges disagree on a pair (cross-judge consistency check)
- A score regresses unexpectedly between commits

The CLI surfaces these pairs via `bun run eval:audit` — typically 5-10 of them per release. The reviewer accepts/rejects/edits the judge's verdict; their decision is then folded back into the rubric or the corpus. The human is the auditor, not the per-pair grader.

This is the same shape production AI teams use — at Anthropic, OpenAI, Sierra, Decagon, etc. The harness is the artifact; humans review the harness's edge cases, not its hot path.

## Ground truth: where it comes from and how it's verified

In a production deployment, ground truth comes from the **customer's domain experts** — the caseworkers, paralegals, claims adjusters who use the system. The engineer's job is to build the harness that consumes their ground truth, not to author it.

For `fedbench` (a portfolio project, no customer), ground truth is sourced two ways:

1. **In-corpus pairs:** drafted from the source PDFs by the project author, then verified two ways: (a) sample-audited by hand against the source PDF, and (b) every pair is automatically validated by the citation-existence check during eval runs (so a wrong page number in the ground truth itself fails loud the first time the eval runs).
2. **Out-of-corpus pairs:** topic-level methodological verification — does the question reference a topic outside the 3-PDF Medicare corpus? This is checked once at design time, not per-pair (the question "what's the SNAP eligibility threshold?" is structurally OOC because SNAP isn't in the corpus, regardless of any specific answer).

Each pair in `eval/questions.jsonl` carries a `verifiedBy` provenance field documenting how it was verified. Pairs without provenance are not scored against.

## Pass/fail thresholds

The eval suite is CI-gated. Default thresholds (configurable in `promptfooconfig.yaml`):

| Metric                        | Threshold |
| ----------------------------- | --------- |
| Citation existence            | 100%      |
| Citation faithfulness         | ≥ 95%     |
| Refusal on out-of-corpus      | 100%      |
| False-refusal on in-corpus    | ≤ 2%      |
| Cost regression vs baseline   | ≤ +20%    |

A change that drops citation faithfulness below 95% breaks the build, regardless of whether the change "feels" like an improvement.

## What we don't measure (and why)

- **Subjective answer quality.** "Does this answer feel helpful?" is not a metric. Helpfulness collapses into the three measurable axes above; if helpful answers don't cite faithfully, they're not actually helpful.
- **Tone or style.** Out of scope. A correct, citation-grounded answer is acceptable in any tone.
- **Latency under load.** Single-stream measurement only. Production load testing is a separate concern.
