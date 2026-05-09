# Eval set verification

This file tracks the hand-verification status of each ground-truth Q&A pair in `questions.jsonl`. Verification is required by the project's contributing rules: ground truth must be hand-confirmed against the source PDFs, never trusted as drafted. Without verification, the eval set scores LLM output against LLM-drafted answers — useless signal.

## v0.1 target: 15 verified pairs

The eval set ships with 15 hand-verified pairs. Composition:

- **12 in-corpus pairs** (`in-001` through `in-011`, plus `in-014`)
- **3 out-of-corpus pairs** (`ooc-001`, `ooc-002`, `ooc-008`)
- **Total: 15 pairs**

`questions.jsonl` contains exactly these 15 entries, no more.

## Already verified

- ✅ `in-001` — Standard Part B premium 2026
- ✅ `in-002` — Initial Enrollment Period (June 15 birthday)
- ✅ `in-003` — IEP shifted for first-of-month birthdays
- ✅ `in-004` — Special Enrollment Period after employer coverage ends
- ✅ `in-005` — Part B late enrollment penalty calculation
- ✅ `in-006` — IRMAA threshold 2026 individual
- ✅ `in-007` — Part A inpatient deductible 2026
- ✅ `in-008` — SNF coverage structure

That's 8 of 15 done.

## Remaining to verify (7 pairs)

For each pair below: open the source PDF in `corpus/raw/` to the cited page, confirm the question is realistic and the answer is accurate, then mark `✅ ACCEPT` / `✏️ EDIT` / `❌ REJECT` and update `questions.jsonl`'s `draftStatus` accordingly.

The source-quote excerpts are pulled from the parsed PDF text to speed verification; they're aids, not replacements for opening the PDF.

---

### in-009 · SNF qualifying hospital stay

**Question:** Under what condition does Medicare cover skilled nursing facility care?
**Drafted answer:** After a 3-day minimum medically necessary inpatient hospital stay (not counting the discharge day) for an illness or injury related to the hospital stay, with a doctor's certification that daily skilled care is needed.
**Citation:** medicare-and-you.pdf, page 29

**Source excerpt:**
> "Medicare covers short-term skilled nursing facility care after a 3-day minimum medically necessary inpatient hospital stay (not including the day you leave the hospital) for an illness or injury related to the hospital stay."
> "your doctor must certify that you need daily skilled care"

**Status:** ☐ accept ☐ edit ☐ reject

---

### in-010 · Benefit period reset

**Question:** How long does a benefit period have to end (no skilled nursing facility care) before a new benefit period can start?
**Drafted answer:** 60 days in a row without skilled nursing facility care.
**Citation:** medicare-and-you.pdf, page 29

**Source excerpt:**
> "Your benefit period ends when you stop getting skilled nursing facility care for 60 days in a row. If you're admitted to the SNF again after those 60 days, a new benefit period will start."

**Status:** ☐ accept ☐ edit ☐ reject

---

### in-011 · Hospice respite care duration

**Question:** How many days can someone stay in a Medicare-approved facility for inpatient respite care under hospice coverage?
**Drafted answer:** Up to 5 days each time they get respite care.
**Citation:** medicare-and-you.pdf, page 27

**Source excerpt:**
> "Medicare also covers inpatient respite care, which is care you get in a Medicare-approved facility so your caregiver (family member or friend) can rest. You can stay for up to 5 days each time you get respite care."

**Status:** ☐ accept ☐ edit ☐ reject

---

### in-014 · Part D late enrollment penalty calculation

**Question:** What's the Part D late enrollment penalty calculation for 2026?
**Drafted answer:** The penalty is 1% of the national base beneficiary premium ($38.99 in 2026) multiplied by the number of full uncovered months the person was eligible for Part D but didn't have creditable coverage. Rounded to the nearest $0.10 and added to the monthly premium.
**Citation:** medicare-and-you.pdf, page 84

**Source excerpt:**
> "the late enrollment penalty is calculated by multiplying 1% of the 'national base beneficiary premium' ($38.99 in 2026) by the number of full, uncovered months that you were eligible but didn't have Medicare drug coverage (Part D) and went without other creditable prescription drug coverage. The final amount is rounded to the nearest $.10 and added to your monthly premium."

**Status:** ☐ accept ☐ edit ☐ reject

---

### ooc-001 · Texas Medicaid eligibility

**Question:** What are the Medicaid income eligibility thresholds for adults in Texas?
**Why it's OOC:** Medicaid is administered at the state level under separate program rules; the Medicare publications don't define state Medicaid thresholds.
**Verification:** Confirm by skimming the corpus that no state-Medicaid eligibility numbers appear. The handbooks reference Medicaid as a separate program but don't publish state-level thresholds.

**Status:** ☐ accept ☐ edit ☐ reject

---

### ooc-002 · VA dental coverage for veterans 65+

**Question:** Does the VA pay for non-service-connected dental care for veterans over 65?
**Why it's OOC:** VA benefits are governed by Department of Veterans Affairs publications, separate from CMS/Medicare material.
**Verification:** The Medicare handbooks reference VA as a "creditable coverage" source but don't define VA benefits. Confirm.

**Status:** ☐ accept ☐ edit ☐ reject

---

### ooc-008 · Phoenix weather

**Question:** What's the weather forecast for Phoenix tomorrow?
**Why it's OOC:** Sanity baseline — completely off-topic. Any sane agent should refuse.
**Verification:** Trivially confirm: weather is not in the corpus. (One of these must exist as a refusal-discipline floor; if the agent fails this one, the rest of the eval is moot.)

**Status:** ☐ accept ☐ edit ☐ reject

---

## Summary

Once the 7 above are verified, all 15 entries in `questions.jsonl` are `verified` and the eval set is ready to score against.

- **12 in-corpus:** `in-001` through `in-011`, plus `in-014`
- **3 out-of-corpus:** `ooc-001`, `ooc-002`, `ooc-008`

## After you verify

1. For each accepted pair: change its `draftStatus` in `questions.jsonl` from `"needs-verification"` to `"verified"` and add `"verifiedBy": "kevinmurphy@source-pdf"`.
2. For any edited pair: apply the edit inline in `questions.jsonl` and mark `"verified"`.
3. For any rejected pair: remove the entry from `questions.jsonl` entirely, then either replace it (re-draft against the same source page) or accept a smaller eval set.
4. Update the README's "Project status" line to note the final eval-set count.
