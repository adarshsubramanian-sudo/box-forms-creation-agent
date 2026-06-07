# Box Forms Agent — User Guide

Build Box Forms from plain English in Cursor. Describe the form you want, watch the agent create it in your Box demo instance, and help make the agent smarter every time you use it.

---

## What this agent does

The **Box Forms Agent** is a two-part AI system that runs inside [Cursor IDE](https://cursor.com):

| Agent | What it does |
|-------|--------------|
| **Builder** (`@box-forms-builder`) | Reads your prompt → plans the form → builds it in Box via browser automation |
| **Grader** (`@box-forms-grader`) | Runs automatically after every build → scores quality → gives actionable feedback |

You only talk to the builder. Grading happens on every run — you never need to invoke the grader yourself.

**Example:** You type:

```
@box-forms-builder Create a contact form with name, email, and message. All fields required.
```

The builder will:

1. Translate your prompt into a structured **FormSpec** (a JSON blueprint of the form)
2. Validate the blueprint before touching the UI
3. Open Box in the browser (Relay → Forms) and create the form field by field
4. Capture a preview screenshot
5. Invoke the grader to score the result
6. Ask you to rate the form (1–10) and optionally leave a comment
7. Report back: form URL, scores, rating status, and any fixes needed

Box Forms has no public API today, so the builder uses **browser automation** — the same clicks and steps you would make manually in the Box web UI.

---

## How it works (end to end)

```
Your prompt in Cursor chat
        ↓
   FormSpec JSON          ← structured plan (fields, logic, branding)
        ↓
   Box web UI             ← browser automation creates the live form
        ↓
   Run log                ← saved locally (prompt, spec, scores)
        ↓
   Grader                 ← scores intent match, field quality, logic, visuals
        ↓
   You rate the form      ← mandatory 1–10 rating + optional comment
        ↓
   Export offer           ← builder asks if you want to share (yes / no / later)
        ↓
   Learning loop          ← low ratings auto-ingest eval cases; high ratings promote golden specs
```

---

## What you need

| Requirement | Required? | Notes |
|-------------|-----------|-------|
| [Cursor IDE](https://cursor.com) | Yes | Browser MCP must be enabled (default in Cursor) |
| Box demo or enterprise account | Yes | You need access to Relay → Forms |
| Node.js 18+ and Python 3 | Yes | For validation scripts |
| Git | Yes | To clone this repo |
| `CURSOR_API_KEY` | No | Only needed if you run batch evals — not for normal use |

**Important:** Use your **own Box demo account**. Do not share one Box login across multiple people building forms at the same time — it causes session conflicts and duplicate form titles.

---

## Setup (one time)

### 1. Clone the repo

```bash
git clone https://github.com/adarshsubramanian-sudo/box-forms-creation-agent.git
cd box-forms-creation-agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your Box instance

```bash
cp .env.example .env
```

Edit `.env` and set your Box URL (no trailing slash):

```
BOX_DEMO_URL=https://your-enterprise.app.box.com
```

Never commit `.env` — it is gitignored.

### 4. Log into Box

Before your first build, open your Box instance in the browser and sign in. The agent reuses your browser session. If your session expires, the agent will pause and ask you to log in again.

### 5. You're ready

Open this project in Cursor. You're set to start building forms.

---

## How to use the agent

### Basic usage

In Cursor chat, mention the builder and describe the form you want:

```
@box-forms-builder Create an employee onboarding form with full name, start date,
department dropdown (Engineering, Sales, Marketing, Other), and show an "Other
Department" text field when Other is selected.
```

Watch the browser automation work in the Box UI. When the build finishes, you'll see:

- **Run ID** — unique identifier for this build (e.g. `20260607-190104-contact`)
- **Box form URL** — link to the form in Box
- **Screenshot** — preview of the built form
- **Scores** — grader results (see below)
- **Feedback** — what went well or what needs fixing
- **Rating prompt** — you'll be asked to rate the form 1–10 before the session ends
- **Export offer** — after rating, the builder asks if you want to export the run for sharing

After several builds, you can share everything in one go — ask in chat:

```
@box-forms-builder Export all my runs from today and draft a GitHub issue for the pilot team.
```

Or run the commands yourself (see [How to submit your run](#how-to-submit-your-run-3-steps) below).

### What the builder supports

| Capability | Example prompt fragment |
|------------|-------------------------|
| Text fields | "full name, email, message" |
| Choice fields | "dropdown with options A, B, C" / "radio buttons for Yes/No" |
| Required fields | "all fields required" |
| Conditional logic | "if Other is selected, show a text field" |
| File upload | "include a file upload for documents" |
| Branding | "use theme color #0061D5" |
| Numbers | "amount as a number field" |

### Starter prompts to try

Copy these into Cursor chat to get started:

**1. Simple contact form**

```
@box-forms-builder Create a contact form with full name, email address, and message
fields. All fields should be required.
```

**2. Onboarding with conditional logic**

```
@box-forms-builder Create an employee onboarding form with full name, start date,
department dropdown (Engineering, Sales, Marketing, Other), and a conditional
other department text field when Other is selected.
```

**3. Benefits enrollment**

```
@box-forms-builder Create a benefits enrollment form. Ask if enrolling in health
insurance (Yes/No radio). If Yes, show dropdown for plan tier (Basic, Plus,
Premium). If No, show a long text reason field.
```

**4. Your own prompt**

Try describing a real form you need — HR intake, vendor onboarding, event RSVP, support tickets. Custom prompts often produce the most valuable feedback for improving the agent.

### If something goes wrong

| Situation | What to do |
|-----------|------------|
| Login page appears | Sign into Box in the browser, then ask the builder to retry |
| Form title conflict | The builder auto-appends a timestamp — retry if it persists |
| Form doesn't match intent | Note the run ID, export it (see below), and submit feedback |
| Browser step fails | The builder saves a partial run — export and report what failed |

You can ask the builder to retry with grader fixes:

```
@box-forms-builder Retry run 20260607-190104-contact with these fixes:
1. Add conditional logic for Other department
```

---

## Understanding grader output

After every build, the grader scores the result on three layers:

| Layer | What it checks | Weight |
|-------|----------------|--------|
| **L1 Deterministic** | Schema valid? Required fields present? Logic rules exist? | 40% |
| **L2 Rubric** | Does the form match your intent? Good labels? Sensible UX? | 35% |
| **L3 Visual** | Does the preview match the spec? Field order correct? | 25% |

You'll see an **overall score** (0.0–1.0) and **pass/fail**. If it fails, the grader provides:

- **Feedback** — what was wrong (e.g. "Department 'Other' logic missing")
- **Suggested fixes** — concrete steps to fix it (e.g. "Add if Department equals Other then show Other Department")

This helps you in the moment. It also becomes the raw material for improving the agent system-wide (see next section).

---

## Human rating (every build)

After grading, the builder **always** asks:

> How would you rate the form built by the agent on a scale of 1 to 10 (10 = best, 1 = worst)?

You can also add an optional comment. Your rating is saved locally and feeds the learning loop:

| Your rating | What happens automatically |
|-------------|---------------------------|
| **≤ 6** | New eval case created from your prompt (prompt-derived expected criteria) |
| **≥ 9** + grader pass | FormSpec promoted to golden reference |
| Grader disagrees (large delta) | Flagged for rubric calibration |

Rate manually if needed:

```bash
npm run record-rating -- --run-id <run_id> --rating 8 --comment "Looks good"
```

---

## How your usage improves the agent

This is a **learning system**. Every person who uses the builder generates signal that makes future builds better — but only when that signal is shared back.

### The flywheel

```
You build a form
      ↓
Grader scores it locally
      ↓
You rate it 1–10 (+ optional comment)
      ↓
Low ratings → auto-ingest eval cases
High ratings → auto-promote golden specs
      ↓
Optionally export & submit via GitHub Issue
      ↓
Maintainer merges eval/rubric updates → everyone pulls
      ↓
Smarter builder on next run
```

### Why this matters

- **More diverse prompts** expose edge cases the original eval set missed (ambiguous wording, tricky conditional logic, branding requests)
- **Failures with corrections** become new test cases — the builder must pass them in future eval runs
- **Repeat patterns** update the grading rubric so the same mistake gets caught consistently
- **High-scoring examples** become few-shot patterns in the builder skill

Your usage directly shapes what the agent learns. The more varied prompts you try — especially ones that fail in interesting ways — the faster the system improves.

### How to submit your run (3 steps)

**Step 1 — Export** (strips Box URLs and sensitive paths):

```bash
npm run export-run -- --run-id <run_id>
```

For multiple runs at once:

```bash
npm run export-runs -- --run-ids <id1>,<id2>
# or all runs from a date:
npm run export-runs -- --since 2026-06-07
```

This creates `data/exports/{run_id}.export.json` with your prompt, FormSpec, scores, and feedback.

**Step 2 — Review** the export file. Remove anything you don't want shared.

**Step 3 — Submit** a GitHub Issue using the **Eval contribution** template:

1. Scaffold a draft issue (optional but recommended for batch submissions):

```bash
npm run create-eval-issue -- --run-ids <id1>,<id2> [--summary "Pilot week 1"]
```

Review `data/exports/eval-issue-draft.md`, then either paste it into GitHub Issues → **Eval contribution**, or add `--create` to submit via `gh` CLI.

2. Or manually: repo → Issues → New Issue → **Eval contribution**
3. Paste the export JSON (or attach the file)
4. Describe what you expected vs what you got
5. Optionally include a corrected FormSpec if you fixed the form manually

Maintainers review submissions weekly and promote the best ones into the shared eval suite.

### Share multiple runs at once

After trying several prompts (e.g. the three starter prompts), export and submit in one batch:

```bash
npm run summarize-ratings                                    # optional overview
npm run export-runs -- --since 2026-06-07                      # or --run-ids id1,id2,id3
npm run create-eval-issue -- --run-ids id1,id2,id3 --summary "Pilot week 1"
```

Review `data/exports/eval-issue-draft.md`, then paste into GitHub Issues or add `--create` to submit with the `gh` CLI.

You can also ask `@box-forms-builder` to run these commands for you in Cursor chat.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

---

## What gets saved locally

Every build creates files on your machine (not uploaded automatically):

| File | Contents |
|------|----------|
| `data/runs/{run_id}.json` | Run summary (prompt, status, scores, URLs) |
| `data/runs/{run_id}.spec.json` | FormSpec blueprint |
| `data/runs/{run_id}.png` | Preview screenshot |
| `data/runs/runs.jsonl` | Append-only log of all runs |
| `data/runs/ratings.jsonl` | Human rating event log |
| `data/exports/{run_id}.export.json` | Anonymized export for sharing (created on demand) |
| `data/exports/eval-issue-draft.md` | Draft GitHub Issue from `create-eval-issue` |

These are gitignored — they stay on your machine unless you explicitly export and submit them.

---

## Tips for best results

1. **Be specific** — "Create a PTO request form with employee name, start date, end date, PTO type dropdown (Vacation, Sick, Personal), and reason" works better than "make a PTO form"
2. **Mention required fields** — say "all required" or call out optional fields explicitly
3. **Describe logic in plain English** — "if Yes, show X; if No, show Y" is enough
4. **One form per prompt** — don't ask for multiple forms in one message
5. **Submit interesting runs** — passes and failures both help; edge cases are especially valuable
6. **Batch-share at end of session** — run several prompts, then export all at once with `export-runs` and `create-eval-issue`
7. **Use your own Box account** — don't share sessions with other pilot users

---

## For maintainers

If you're running the pilot or maintaining the eval suite:

| Task | Command / doc |
|------|---------------|
| Record human rating | `npm run record-rating -- --run-id <id> --rating <1-10>` |
| Summarize ratings | `npm run summarize-ratings` |
| Ingest a submitted run | `npm run ingest-feedback -- --run-id <id> [--corrected-spec path]` |
| Run eval suite | `npm run eval` |
| Pilot playbook | [docs/pilot-kickoff.md](docs/pilot-kickoff.md) |
| Improvement loop | [docs/improvement-workflow.md](docs/improvement-workflow.md) |
| GitHub setup | [docs/github-setup.md](docs/github-setup.md) |

---

## Project structure

```
.cursor/
  agents/              # Builder and grader agent definitions
  skills/box-forms/    # FormSpec schema, UI map, validation scripts
evals/                 # Shared eval cases, rubric, golden specs
scripts/               # Export, ingest, eval runner
specs/                 # FormSpec JSON schema
data/runs/             # Your local run history (gitignored)
docs/                  # Pilot guide, improvement workflow, GitHub setup
```

---

## Constraints

- **Unique form titles** — Box requires unique names; the builder appends a timestamp automatically
- **Session expiry** — re-authenticate in the browser when prompted
- **No Forms API** — browser automation can be slower or flaky; validation runs before UI work to catch errors early
- **Improvement is local-first** — ratings auto-ingest eval cases on your machine; share exports via GitHub when ready

---

## Quick reference

| I want to… | Do this |
|------------|---------|
| Build a form | `@box-forms-builder <describe your form>` |
| Rate a build | Answer the 1–10 prompt, or `npm run record-rating -- --run-id <id> --rating <1-10>` |
| Export a run for feedback | `npm run export-run -- --run-id <id>` |
| Export multiple runs | `npm run export-runs -- --run-ids <id1>,<id2>` or `--since YYYY-MM-DD` |
| Draft GitHub Issue from exports | `npm run create-eval-issue -- --run-ids <ids> [--create]` |
| Share all runs from a date | `npm run export-runs -- --since YYYY-MM-DD` then `create-eval-issue` |
| Submit feedback | GitHub Issue → Eval contribution template |
| Retry after grader feedback | `@box-forms-builder Retry run <id> with these fixes: ...` |
| Validate a FormSpec manually | `npm run validate-spec -- path/to/spec.json` |

---

## Questions?

- **Usage & feedback:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Pilot program:** [docs/pilot-kickoff.md](docs/pilot-kickoff.md)
- **How the system improves:** [docs/improvement-workflow.md](docs/improvement-workflow.md)
