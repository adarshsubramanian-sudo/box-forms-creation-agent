# Pilot Kickoff Guide

Use this guide to run a 5–15 person pilot of the Box Forms builder + grader system.

## Goals

1. **Experience** — Participants try natural-language → live Box Form in Cursor
2. **Signal** — Diverse prompts and grader scores feed the shared eval corpus via curated feedback

## Prerequisites per participant

| Requirement | Notes |
|-------------|-------|
| Cursor IDE | Browser MCP enabled |
| Box demo account | Individual sandbox preferred — avoid shared concurrent browser automation |
| Repo clone | `git clone` + `cp .env.example .env` + `npm install` |
| Box login | Authenticate in browser before first build |

`CURSOR_API_KEY` is **optional** — only needed for batch evals, not interactive builds.

## Cohort setup

- **Size:** 5–15 users
- **Duration:** 2–4 weeks
- **Box access:** One demo account per participant (or small team sandbox)
- **Channel:** Slack/Teams thread for questions and export submissions

## Week 0 — Onboarding (maintainer)

1. Push repo to GitHub (private org repo recommended)
2. Invite pilot users with read access
3. Share this doc + [README](../README.md) pilot section
4. Confirm each user can run one starter prompt successfully

## Starter prompts (week 1)

Ask each participant to run these three prompts via `@box-forms-builder`:

| # | Prompt | Eval reference |
|---|--------|----------------|
| 1 | Create a contact form with full name, email address, and message fields. All fields should be required. | `contact-basic` |
| 2 | Create an employee onboarding form with full name, start date, department dropdown (Engineering, Sales, Marketing, Other), and a conditional other department text field when Other is selected. | `onboarding-basic` |
| 3 | Create a benefits enrollment form. Ask if enrolling in health insurance (Yes/No radio). If Yes, show dropdown for plan tier (Basic, Plus, Premium). If No, show a long text reason field. | `insurance-conditional` |

Participants may also try their own prompts — those often produce the best eval signal.

## Week 1–N — Usage + feedback

### Participant workflow

1. Build a form with `@box-forms-builder`
2. Review grader output in chat
3. If interesting (pass or fail), export the run:
   ```bash
   npm run export-run -- --run-id <run_id>
   ```
4. Submit via GitHub Issue (Eval contribution template) or post export JSON in pilot channel

### Maintainer weekly ritual (30–60 min)

| Step | Action |
|------|--------|
| Triage | Review Issue submissions and pilot channel exports |
| Curate | Anonymize; reject duplicates or low-signal cases |
| Ingest | `npm run ingest-feedback -- --run-id <id> [--corrected-spec path] [--promote-golden]` |
| Rubric | If same failure appears 3+ times, update `evals/rubric.md` version |
| Measure | `npm run eval` → compare pass rate to previous `data/runs/eval_report_*.json` |
| Release | Merge eval/rubric changes to `main`; notify pilot to `git pull` |

## Success metrics

### Experience

| Metric | How to measure |
|--------|----------------|
| Time to first form | Onboarding call or survey |
| Completion rate | % who finish all 3 starter prompts |
| Intent match | Qualitative: "Did the form match what you asked for?" (1–5) |

### Learning

| Metric | How to measure |
|--------|----------------|
| Submissions per week | Count GitHub Issues + channel exports |
| Novel cases ingested | New lines in `evals/cases.jsonl` with `category: from_feedback` |
| Pass rate trend | `eval_report_*.json` summary over time |
| Repeat failure patterns | `data/runs/feedback.jsonl` |

## What not to do

- **Don't share one Box account** across many concurrent builders — title collisions and session conflicts
- **Don't auto-merge unreviewed exports** — quality regressions are possible
- **Don't commit `.env` or run artifacts** — use `export_run.ts` for sharing

## Escalation

| Issue | Action |
|-------|--------|
| Login page during build | Re-authenticate in browser |
| Duplicate title error | Builder should append timestamp; report if persistent |
| Browser automation flaky | Export run + note UI step that failed; maintainer adds edge case |
| Grader disagrees with human | Submit export with corrected FormSpec for golden promotion |

## After the pilot

1. Summarize pass rate improvement and cases added
2. Decide: expand cohort, add centralized telemetry, or keep GitHub Issue workflow
3. Archive high-scoring FormSpecs as skill examples (overall ≥ 0.95)

See [improvement-workflow.md](improvement-workflow.md) for the full continuous improvement loop.
