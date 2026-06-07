# Contributing to the Box Forms Agent

Thank you for helping improve the builder and eval suite. This project improves through **feedback loops** — your runs and ratings become eval cases that make future builds better.

## Human rating (automatic)

After every interactive build, the builder asks you to rate the form **1–10** (10 = best) and optionally leave a comment.

- **Low ratings (≤6)** automatically create eval cases from your prompt (full auto-ingest)
- **High ratings (≥9) + grader pass** automatically promote the FormSpec as a golden reference
- Ratings are stored locally in `data/runs/{run_id}.json` and `data/runs/ratings.jsonl`

You can also rate manually:

```bash
npm run record-rating -- --run-id <run_id> --rating 8 --comment "Looks good"
```

Or in chat:

```
@box-forms-builder Rate run <run_id> 8/10 optional comment
```

## Prerequisites

- [Cursor IDE](https://cursor.com) with browser MCP enabled
- Box demo or enterprise account (set `BOX_DEMO_URL` in `.env`)
- Node.js 18+ and Python 3

Interactive form building does **not** require `CURSOR_API_KEY`. That key is only for batch eval runs (`npm run eval`).

## Quick setup

```bash
git clone <repo-url>
cd box-forms-creation-agent
cp .env.example .env
# Edit .env: set BOX_DEMO_URL

npm install
```

Log into your Box instance in the browser before invoking `@box-forms-builder`.

## How to submit feedback

After a build completes (grader runs automatically):

### 1. Export your run

```bash
npm run export-run -- --run-id <run_id>
```

This writes an anonymized JSON to `data/exports/{run_id}.export.json` with:

- Source prompt
- FormSpec (no Box URLs)
- Grader scores, feedback, and suggested fixes
- Human rating and comment (if collected)

Review the file before sharing. Remove anything sensitive if you added custom labels or options.

### 2. Open a GitHub Issue

Use the **Eval contribution** issue template (`.github/ISSUE_TEMPLATE/eval-contribution.md`):

- Paste the export JSON or attach the file
- Optionally include a corrected FormSpec if you fixed the form manually
- Describe what you expected vs what you got

### 3. Maintainer review

Maintainers will:

1. Review and anonymize further if needed
2. Run `npm run ingest-feedback` to add cases to `evals/cases.jsonl`
3. Update `evals/rubric.md` if the same failure repeats 3+ times
4. Re-run `npm run eval` to verify pass rate

## Submitting eval cases via PR

For contributors with write access:

1. Export the run locally
2. Add a new line to `evals/cases.jsonl` following existing format
3. Add matching `evals/expected/{case_id}.json`
4. Optionally add `evals/golden/{case_id}.json` for structural diff
5. Run `npm run eval:dry` to validate case structure
6. Open a PR describing the failure pattern and fix

Do **not** commit:

- `.env` or session files
- `data/runs/*.json` (local run artifacts)
- `data/exports/` (local exports)

## Rubric and skill changes

Before changing `evals/rubric.md` or `.cursor/skills/box-forms/SKILL.md`:

1. Run full eval suite: `npm run eval`
2. Pass rate must not drop more than 5% vs last report
3. Document the change in the rubric version history

See [docs/improvement-workflow.md](docs/improvement-workflow.md) for the full loop.

## Pilot participants

If you are in the pilot cohort, see [docs/pilot-kickoff.md](docs/pilot-kickoff.md) for starter prompts, success metrics, and the weekly feedback ritual.
