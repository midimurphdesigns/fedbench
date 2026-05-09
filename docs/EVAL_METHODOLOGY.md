# Evaluation methodology

How `fedbench` measures the failure modes of grounded document Q&A.

## What we measure

Three first-class metrics. Each one is a numeric score per question; aggregates roll up across the eval set.

### 1. Citation accuracy

For every factual claim in the agent's answer, does it cite a real page or section in the source document, and does that page or section actually contain the claim?

Scored on two sub-axes:

- **Citation existence.** The cited page/section exists in the document. (Boolean per claim.)
- **Citation faithfulness.** The cited location actually supports the claim. (Boolean per claim, judged by an LLM-as-judge with the cited chunk as evidence.)

Failure modes caught:
- Made-up section numbers
- Real section numbers that don't actually contain the claimed fact
- Claims that combine information from multiple sections without citing both

### 2. Refusal discipline

When the answer is *not* in the document, does the agent say so?

The eval set includes a designated subset of "out-of-corpus" questions — questions whose answers do not exist anywhere in the loaded documents. For each, the metric is:

- **Refusal rate** on out-of-corpus questions: ideally 100%.
- **False-refusal rate** on in-corpus questions: should be ~0%. The agent shouldn't refuse questions it could answer correctly.

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

## How we score

### LLM-as-judge

A second model evaluates the primary model's output. The judge runs on different prompts and a different temperature than the primary; the answers it scores include the cited chunk as evidence so the judge isn't relying on its own knowledge.

Judge models are versioned in the eval config. Changing the judge changes the score baseline; the change is explicit and reviewable.

### Ground-truth comparison

For each in-corpus question, the eval set includes:

- The verified correct answer (hand-written, sourced from the document)
- The page/section where the answer appears
- A list of "acceptable" alternative phrasings

The agent's answer is scored against all three: does it match semantically, does it cite the right location, does it stay within the acceptable variation envelope?

### Pass/fail thresholds

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

## Ground truth: how it's built

Ground truth is hand-written, never LLM-generated. The process for adding a question to the eval set:

1. Pick a question a real user would ask.
2. Find the answer in the source document. Note the page and section.
3. Write the verified answer in your own words.
4. List 2-4 acceptable alternative phrasings.
5. Mark whether the question is in-corpus or out-of-corpus (for refusal-discipline scoring).

This is tedious. It's also the most important part of the eval — no automated process can do it reliably, and using LLM-generated ground truth contaminates the scoring loop. See [`docs/CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution rules.
