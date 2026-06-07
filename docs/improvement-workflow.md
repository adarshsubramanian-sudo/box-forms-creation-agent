# Continuous Improvement Workflow

This document describes how the Box Forms agent system improves over time.

## Loop overview

```
Usage or eval run
       ↓
Builder creates form → Run logged (data/runs/)
       ↓
Grader scores (L1 → L2 → L3)
       ↓
   Pass? ──yes──→ Archive as positive example (optional)
       │
       no
       ↓
Human review OR builder retry with suggested_fixes
       ↓
ingest-feedback → new eval case + optional golden spec
       ↓
Rubric/skill update if pattern repeats
       ↓
Re-run evals → measure pass rate
```

## Run logging

Every build appends to `data/runs/runs.jsonl`:

```json
{
  "type": "eval_result",
  "case_id": "contact-basic",
  "run_id": "20260607-143022-contact-basic",
  "pass": true,
  "scores": { "deterministic": 1.0, "rubric": 0.9, "visual": 0.95, "overall": 0.95 },
  "at": "2026-06-07T14:35:00Z"
}
```

Full artifacts live in `data/runs/{run_id}.json` (gitignored).

## Ingesting feedback

When a run fails and you fix the form manually (or the builder retries successfully):

```bash
# Add corrected spec as new eval case
npm run ingest-feedback -- --run-id 20260607-143022-onboarding-basic \
  --corrected-spec data/runs/20260607-143022-onboarding-basic.fixed.spec.json

# Also promote to golden reference
npm run ingest-feedback -- --run-id <run_id> \
  --corrected-spec path/to/fixed.json \
  --promote-golden
```

This:
1. Appends a new case to `evals/cases.jsonl`
2. Writes `evals/expected/{case_id}.json`
3. Optionally writes `evals/golden/{case_id}.json`
4. Logs to `data/runs/feedback.jsonl`

## Rubric versioning

Rubric lives at `evals/rubric.md` with a version header.

**When to update:**
- The same failure appears in 3+ runs (check `feedback.jsonl` and run artifacts)
- A new Box Forms capability is supported
- Eval pass rate stalls below target despite builder retries

**How to update:**
1. Increment version in `evals/rubric.md` version table
2. Document the change in the version history section
3. Re-run eval suite: `npm run eval`
4. Compare pass rate to previous report in `data/runs/eval_report_*.json`

Grader agent reads `rubric_version` from the rubric header and records it in scored runs.

## Skill few-shot updates

When a run passes with high scores (overall ≥ 0.95):

1. Copy the FormSpec into `.cursor/skills/box-forms/SKILL.md` Examples section
2. Keep at most 5 examples (remove oldest)
3. Prefer diverse categories (intake, logic, branding, file upload)

Do not add failing or partial specs as examples.

## Regression gate

Before merging rubric or skill changes:

1. Run full eval suite: `npm run eval`
2. Pass rate must not drop more than 5% vs last report
3. No new deterministic failures on golden specs

Dry-run planning (no SDK cost):

```bash
npm run eval:dry
```

## Metrics to track

| Metric | Source |
|--------|--------|
| Pass rate (overall) | `eval_report_*.json` summary |
| Pass rate by category | `by_category` in report |
| L1/L2/L3 breakdown | Individual run scores |
| Human override rate | Runs with `ingested: true` after manual fix |
| Repeat failure patterns | `feedback.jsonl` |

## Scheduled evals (optional)

Use Cursor Automations with a cron trigger to run:

```bash
cd "/Users/adarshsubramanian/Forms Creation Agent" && npm run eval
```

Alert on failure via Slack/email action in the automation workflow.

## Retry workflow

On grader fail, the builder should receive:

```
@box-forms-builder Retry run {run_id} with these fixes:
1. <suggested_fix from grader>
```

Max 2 retries per eval case before marking as fail.

## File reference

| File | Purpose |
|------|---------|
| `evals/cases.jsonl` | All eval prompts + expected criteria |
| `evals/expected/*.json` | Synced from cases (via sync_expected.ts) |
| `evals/golden/*.json` | Reference FormSpecs for structural diff |
| `evals/rubric.md` | Grading rubric (versioned) |
| `data/runs/runs.jsonl` | Append-only event log |
| `data/runs/feedback.jsonl` | Ingestion audit trail |
