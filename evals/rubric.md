# Box Forms Grading Rubric

**Version:** 1.0.0  
**Last updated:** 2026-06-07

When updating this rubric, increment the version and note changes in [docs/improvement-workflow.md](../docs/improvement-workflow.md).

## Scoring weights

| Layer | Weight | Method |
|-------|--------|--------|
| L1 Deterministic | 0.40 | `validate_spec.py` + expected criteria diff |
| L2 Rubric | 0.35 | LLM evaluation against dimensions below |
| L3 Visual | 0.25 | Preview screenshot / browser verification |

**Pass threshold:** 0.80 overall (configurable via `EVAL_PASS_THRESHOLD`).

If L3 is skipped (browser failure), weights redistribute: L1 +60%, L2 +40% of L3 weight.

---

## L2 dimensions

Score each dimension 0.0–1.0. Rubric score = arithmetic mean.

### 1. Intent match (critical)

| Score | Criteria |
|-------|----------|
| 1.0 | Every requirement in the prompt is reflected in the form |
| 0.7 | Minor omissions (e.g. missing optional help text) |
| 0.4 | Major omission (missing field or logic) |
| 0.0 | Form does not address the prompt |

### 2. Field quality

| Score | Criteria |
|-------|----------|
| 1.0 | Correct types, clear labels, appropriate required flags |
| 0.7 | One suboptimal type choice or label |
| 0.4 | Multiple wrong types or confusing labels |
| 0.0 | Fields unrelated to prompt |

### 3. Logic correctness

| Score | Criteria |
|-------|----------|
| 1.0 | All conditional rules correct (or N/A if no logic needed) |
| 0.7 | Logic present but one condition/outcome slightly wrong |
| 0.4 | Logic missing when required, or wrong targets |
| 0.0 | Logic contradicts prompt |

N/A: when prompt has no conditional requirements, score 1.0 if no spurious logic added.

### 4. UX completeness

| Score | Criteria |
|-------|----------|
| 1.0 | Logical field order, placeholders where helpful, descriptions if needed |
| 0.7 | Acceptable but bare minimum |
| 0.4 | Confusing order or missing placeholders on complex fields |
| 0.0 | Unusable layout |

### 5. Branding

| Score | Criteria |
|-------|----------|
| 1.0 | Theme color and/or logo applied as requested |
| 0.7 | Partial branding (color only when both requested) |
| 1.0 | N/A — no branding requested and none added |
| 0.0 | Branding requested but missing |

---

## L3 visual checks

| Check | Pass | Fail |
|-------|------|------|
| Field count in preview matches spec | All fields visible | Missing or extra fields |
| Field labels match spec | Exact or equivalent | Wrong labels |
| Required indicators | Present on required fields | Missing markers |
| Logic behavior | Show/hide works in preview | Logic broken or untested |
| Branding visible | Color/logo in preview | Not applied |

---

## Automatic failures (override pass)

These fail the run regardless of overall score:

- Schema validation errors
- Missing field from `expected.required_fields` in eval case
- `must_have_logic: true` but zero logic rules
- Duplicate form title causing save failure without recovery

---

## Feedback quality standards

Each `feedback` item must:
- Reference a specific field, rule, or requirement
- State what is wrong, not just that something is wrong

Each `suggested_fix` must:
- Be actionable by the builder agent
- Prefer FormSpec changes over vague UI instructions

**Good:** "Add logic: when Department equals Other, show field other_department"  
**Bad:** "Logic could be better"

---

## Version history

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-07 | Initial rubric |
