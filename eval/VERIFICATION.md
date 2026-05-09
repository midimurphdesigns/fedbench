# Eval set verification

This is the workspace for verifying ground-truth Q&A pairs in `questions.jsonl` against the source documents. Every pair must be hand-verified before the eval set is treated as authoritative.

## How to use this file

For each pair below:

1. Open the source PDF in `corpus/raw/` to the cited page.
2. Confirm the question is realistic and the answer is accurate.
3. Mark the pair `✅ ACCEPT`, `✏️ EDIT` (with edits noted), or `❌ REJECT` (with a brief reason).
4. Update `questions.jsonl` so the corresponding entry's `draftStatus` becomes `verified` (accepted) or is removed (rejected). Edits go inline in the JSONL.

## Pair-by-pair worksheet

Source-quote excerpts below are pulled from the parsed PDF text to make verification faster; they're aids, NOT replacements for opening the actual PDF.

---

### in-001 · Standard Part B premium 2026

**Question:** What's the standard Part B premium amount in 2026?
**Drafted answer:** The standard Part B premium amount in 2026 is $202.90 per month.
**Citation:** medicare-and-you.pdf, page 23

**Source excerpt:**
> "How much does Part B coverage cost? The standard Part B premium amount in 2026 is $202.90. Most people pay the standard Part B premium amount every month."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-002 · Initial Enrollment Period (June 15 birthday)

**Question:** When does the Initial Enrollment Period for Part A and Part B begin and end for someone whose 65th birthday is on June 15?
**Drafted answer:** The Initial Enrollment Period is a 7-month window that begins 3 months before the month they turn 65 and ends 3 months after the month they turn 65. For a June 15 birthday, the window begins March and ends September.
**Citation:** medicare-and-you.pdf, page 17

**Source excerpt:**
> "Generally, you can first sign up for Part A and/or Part B during the 7-month period that begins 3 months before the month you turn 65 and ends 3 months after the month you turn 65."
> "Example: If you turn 65 on June 2, your 7-month period would begin in March and end in September."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-003 · IEP shifted for first-of-month birthdays

**Question:** If someone's 65th birthday falls on the first day of the month, when does their Initial Enrollment Period start and end?
**Drafted answer:** When the birthday is on the first of the month, the 7-month Initial Enrollment Period starts 4 months before the month they turn 65 and ends 2 months after the month they turn 65.
**Citation:** medicare-and-you.pdf, page 17

**Source excerpt:**
> "If your birthday is on the first of the month, your 7-month period starts 4 months before the month you turn 65 and ends 2 months after the month you turn 65."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-004 · Special Enrollment Period after employer coverage ends

**Question:** How long is the Special Enrollment Period after employer group health plan coverage ends?
**Drafted answer:** 8 months, beginning the month after the employment ends or the coverage ends, whichever happens first.
**Citation:** medicare-and-you.pdf, page 17

**Source excerpt:**
> "During the 8-month period that begins the month after the employment ends or the coverage ends, whichever happens first"

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-005 · Part B late enrollment penalty calculation

**Question:** What's the Part B late enrollment penalty for someone whose Initial Enrollment Period ended December 2021 and who waited until March 2024 to sign up?
**Drafted answer:** The Part B premium goes up 10% for each full 12-month period that they could have had Part B but didn't. From December 2021 to March 2024 spans two full 12-month periods, so the penalty is 20%.
**Citation:** medicare-and-you.pdf, page 23

**Source excerpt:**
> "Your monthly Part B premium may go up 10% for each full 12 months in the period that you could've had Part B, but didn't sign up."
> "Example: Mr. Smith's Initial Enrollment Period ended December 2021. He waited until March 2024 (during the General Enrollment Period) to sign up for Part B. His Part B premium penalty is 20%"

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-006 · IRMAA threshold 2026 individual

**Question:** For a 2026 single tax filer, at what income level does the IRMAA Part B surcharge begin to apply?
**Drafted answer:** If modified adjusted gross income on the 2024 IRS return was above $109,000 for an individual filer (or $218,000 for joint filers), an IRMAA may apply for 2026.
**Citation:** medicare-and-you.pdf, page 23

**Source excerpt:**
> "For 2026, if your modified adjusted gross income for 2024 was above $109,000 if you file individually or $218,000 if you're married and file jointly, then you may pay an IRMAA."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-007 · Part A inpatient deductible 2026

**Question:** What's the Part A inpatient hospital deductible per benefit period in 2026?
**Drafted answer:** $1,736 per benefit period in 2026.
**Citation:** medicare-and-you.pdf, page 27

**Source excerpt:**
> "Each time you start a new benefit period, you must pay $1,736 (in 2026) before Medicare s[tarts to pay]"

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-008 · SNF coverage structure

**Question:** How many days of skilled nursing facility care does Medicare cover in a benefit period, and what's the daily cost structure?
**Drafted answer:** Medicare covers up to 100 days of skilled nursing facility care per benefit period. Days 1-20 are $0 each day after the $1,736 deductible. Days 21-100 are $217 each day. Days 101 and beyond, the patient pays all costs.
**Citation:** medicare-and-you.pdf, page 29

**Source excerpt:**
> "Days 1–20: You pay $0 each day after you pay the $1,736 amount."
> "Days 21–100: You pay $217 each day."
> "Days 101 and beyond: You pay all costs."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-009 · SNF qualifying hospital stay

**Question:** Under what condition does Medicare cover skilled nursing facility care?
**Drafted answer:** After a 3-day minimum medically necessary inpatient hospital stay (not counting the discharge day) for an illness or injury related to the hospital stay, with a doctor's certification that daily skilled care is needed.
**Citation:** medicare-and-you.pdf, page 29

**Source excerpt:**
> "Medicare covers short-term skilled nursing facility care after a 3-day minimum medically necessary inpatient hospital stay (not including the day you leave the hospital) for an illness or injury related to the hospital stay."
> "your doctor must certify that you need daily skilled care"

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-010 · Benefit period reset

**Question:** How long does a benefit period have to end (no skilled nursing facility care) before a new benefit period can start?
**Drafted answer:** 60 days in a row without skilled nursing facility care.
**Citation:** medicare-and-you.pdf, page 29

**Source excerpt:**
> "Your benefit period ends when you stop getting skilled nursing facility care for 60 days in a row. If you're admitted to the SNF again after those 60 days, a new benefit period will start."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-011 · Hospice respite care duration

**Question:** How many days can someone stay in a Medicare-approved facility for inpatient respite care under hospice coverage?
**Drafted answer:** Up to 5 days each time they get respite care.
**Citation:** medicare-and-you.pdf, page 27

**Source excerpt:**
> "Medicare also covers inpatient respite care, which is care you get in a Medicare-approved facility so your caregiver (family member or friend) can rest. You can stay for up to 5 days each time you get respite care."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-012 · Hospice respite care cost share

**Question:** What's the cost-sharing for inpatient respite care under Medicare hospice?
**Drafted answer:** Five percent of the Medicare-approved amount.
**Citation:** medicare-and-you.pdf, page 27

**Source excerpt:**
> "Five percent of the Medicare-approved amount for inpatient respite care."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-013 · Colonoscopy screening frequency

**Question:** How often does Medicare cover screening colonoscopies for someone not at high risk?
**Drafted answer:** Once every 120 months (10 years), or every 24 months if at high risk, or 48 months after a previous flexible sigmoidoscopy.
**Citation:** medicare-and-you.pdf, page 36

**Source excerpt:**
> "Screening colonoscopies: Medicare covers this screening test once every 120 months (or every 24 months if you're at high risk) or 48 months after a previous flexible sigmoidoscopy."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-014 · Part D late enrollment penalty calculation

**Question:** What's the Part D late enrollment penalty calculation for 2026?
**Drafted answer:** The penalty is 1% of the national base beneficiary premium ($38.99 in 2026) multiplied by the number of full uncovered months the person was eligible for Part D but didn't have creditable coverage. Rounded to the nearest $0.10 and added to the monthly premium.
**Citation:** medicare-and-you.pdf, page 84

**Source excerpt:**
> "the late enrollment penalty is calculated by multiplying 1% of the 'national base beneficiary premium' ($38.99 in 2026) by the number of full, uncovered months that you were eligible but didn't have Medicare drug coverage (Part D) and went without other creditable prescription drug coverage. The final amount is rounded to the nearest $.10 and added to your monthly premium."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-015 · 63-day creditable coverage gap

**Question:** How many days without creditable prescription drug coverage triggers a possible Part D late enrollment penalty?
**Drafted answer:** 63 or more days in a row without Medicare drug coverage or other creditable prescription drug coverage.
**Citation:** medicare-and-you.pdf, page 84

**Source excerpt:**
> "If you go 63 days or more in a row without Medicare drug coverage or other creditable prescription drug coverage, you may have to pay a penalty if you sign up for Medicare drug coverage later."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-016 · Part D out-of-pocket cap 2026

**Question:** What's the Part D out-of-pocket cap on covered drugs in 2026?
**Drafted answer:** $2,100 in 2026. Once the cap is reached, no copayment or coinsurance is owed for covered Part D drugs for the rest of the calendar year.
**Citation:** medicare-and-you.pdf, page 2

**Source excerpt:**
> "If you have Medicare drug coverage (Part D), your yearly out-of-pocket Part D drugs are capped at $2,100 in 2026. Once you reach this cap, you won't have to pay a copayment or coinsurance for covered Part D drugs for the rest of the calendar year."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-017 · Insulin monthly cap

**Question:** What's the maximum monthly cost for a one-month supply of covered insulin under Part D and Part B?
**Drafted answer:** No more than $35 for a one-month supply of each Part D- and Part B-covered insulin product. There's no deductible for insulin.
**Citation:** your-medicare-benefits.pdf, page 61

**Source excerpt:**
> "The cost of a one-month supply of each Part D- and Part B-covered insulin product is no more than $35, and you don't have to pay a deductible for insulin."

**Note:** double-check the page number — the parsed text shows this content near the front of the booklet's "Section 2: Items & Services" but the page-number anchor in the file may differ from the printed page number. Confirm by opening the PDF directly.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-018 · Inpatient hospital days 61-90 cost

**Question:** What does inpatient hospital care cost per day in days 61-90 of a benefit period in 2026?
**Drafted answer:** $434 per day for days 61-90.
**Citation:** your-medicare-benefits.pdf, page 58

**Source excerpt:**
> "Days 61–90: You pay $434 each day."

**Note:** same note as in-017 — parsed page number may differ from printed page number. Confirm in the PDF.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-019 · What inpatient hospital does NOT cover

**Question:** What does Medicare-covered inpatient hospital care NOT include?
**Drafted answer:** Medicare doesn't cover private-duty nursing, a television or phone in the room (if there's a separate charge), personal care items like razors or slipper socks, or a private room unless medically necessary.
**Citation:** medicare-and-you.pdf, page 27

**Source excerpt:**
> "Medicare doesn't cover private-duty nursing, a television or phone in your room (if there's a separate charge for these items), personal care items (like razors or slipper socks), or a private room unless it's necessary to diagnose or treat your illness, injury, condition, or disease."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-020 · Extra Help income limits 2025 single

**Question:** In 2025, what are the income and resource limits to qualify for Extra Help as a single person?
**Drafted answer:** Less than $23,475 in yearly income and less than $17,600 in resources. (Note: limits may be higher if the person works, lives in Alaska/Hawaii, or has dependents.)
**Citation:** medicare-and-you.pdf, page 92

**Source excerpt:**
> "You may qualify for Extra Help if your yearly income and resources are below these limits in 2025: ... Single person less than $23,475 less than $17,600"
> "In some situations, you may qualify even if you have a higher income. For example, if you still work, live in Alaska or Hawaii, or have dependents living with you, the income limits are higher."

**Note:** This question references **2025** numbers because the source text uses 2025 figures. Verify whether you want the eval to track 2025 or 2026 — the corpus mixes years (handbook is "2026" but Extra Help limits cited there are 2025). Either is defensible; just be consistent.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-021 · MSPs in territories

**Question:** Are Medicare Savings Programs available in Puerto Rico or the U.S. Virgin Islands?
**Drafted answer:** No. Medicare Savings Programs are not available in Puerto Rico or the U.S. Virgin Islands.
**Citation:** medicare-and-you.pdf, page 92

**Source excerpt:**
> "Medicare Savings Programs are available through your state. The names of these programs and how they work may vary by state. Medicare Savings Programs aren't available in Puerto Rico or the U.S. Virgin Islands."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### in-022 · Extra Help appeal window

**Question:** How long does someone have to file an appeal after Social Security denies an Extra Help application?
**Drafted answer:** 60 days after receiving the denial letter. Social Security assumes the letter was received 5 days after the date on it, unless the applicant shows otherwise.
**Citation:** medicare-prescription-drug-coverage.pdf, page 36

**Source excerpt:**
> "You have 60 days to file an appeal."
> "Your 60 days start the day after you get a letter from Social Security denying your application. Social Security will assume you got the letter 5 days after the date on it, unless you show them you didn't get it within the 5-day period."

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

## Out-of-corpus questions (refusal-test set)

These have NO answers in the corpus. The expected behavior is for the agent to refuse, not guess. Verifying these means confirming: (a) the question is plausibly close to the corpus topic (so the agent has to actually decide to refuse, not just shrug), (b) the answer truly isn't in any of the three documents.

### ooc-001 · Texas Medicaid eligibility

**Question:** What are the Medicaid income eligibility thresholds for adults in Texas?
**Why it's OOC:** Medicaid is administered at the state level under different program rules; the Medicare publications don't define state Medicaid thresholds.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### ooc-002 · VA dental coverage for veterans 65+

**Question:** Does the VA pay for non-service-connected dental care for veterans over 65?
**Why it's OOC:** VA benefits are governed by Department of Veterans Affairs publications, separate from Medicare/CMS material.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### ooc-003 · SNAP eligibility for family of four in California

**Question:** What's the SNAP household-size income limit for a family of four in California?
**Why it's OOC:** SNAP rules live with USDA Food and Nutrition Service and state-administered programs, not Medicare publications.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### ooc-004 · SSA retirement benefit calculation

**Question:** What's the Social Security retirement benefit amount for someone with $80,000 in average indexed monthly earnings claiming at full retirement age?
**Why it's OOC:** Social Security retirement benefit calculations are in SSA program publications (the PIA/AIME formula), not in Medicare handbooks.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### ooc-005 · SSI federal benefit rate 2026

**Question:** What's the SSI federal benefit rate for an eligible individual in 2026?
**Why it's OOC:** SSI is a separate program; rates are published by SSA in different documents.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### ooc-006 · Abortion coverage under Medicare

**Question:** Are abortion services covered under Medicare?
**Why it's OOC:** Edge case — coverage is governed by federal regulation and CMS National Coverage Determinations, not the consumer-handbook publications in this corpus. The handbooks don't address this directly.

**Note:** If you skim the corpus and find this IS addressed, move it to the in-corpus set. I haven't done a full corpus search for it.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### ooc-007 · Federal tax filing deadline

**Question:** What's the deadline to file federal taxes in 2026?
**Why it's OOC:** Tax filing deadlines are IRS rules, not in any of the three Medicare publications.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

### ooc-008 · Phoenix weather

**Question:** What's the weather forecast for Phoenix tomorrow?
**Why it's OOC:** Sanity baseline — completely off-topic. Any sane agent should refuse.

**Status:** ☐ accept ☐ edit ☐ reject — _your call_

---

## Summary

- **22 in-corpus pairs** (in-001 through in-022)
- **8 out-of-corpus pairs** (ooc-001 through ooc-008)
- **Total: 30 pairs** for v0.1 of the eval set

After verification:

1. Update each accepted pair's `draftStatus` from `"needs-verification"` to `"verified"` in `eval/questions.jsonl`.
2. Apply edits inline in the JSONL.
3. Remove rejected pairs entirely.
4. If the verified count drops below ~25, source replacement candidates from the same fact-dense pages identified in this draft (handbook pages 17, 20, 22-23, 27, 29, 36, 76, 84, 92; benefits booklet pages 58-67, 101-106; drug coverage pages 19-21, 32-38).
