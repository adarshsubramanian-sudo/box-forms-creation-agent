# Box Forms Creation + Grading Agent System

Build Box Forms from natural language prompts in your demo Box instance, with automated grading and a continuous improvement loop.

## Overview

| Component | Purpose |
|-----------|---------|
| **Builder agent** | Parses prompts → FormSpec JSON → browser automation → auto-invokes grader |
| **Grader agent** | Runs after every build; scores output (deterministic + rubric + visual) |
| **Eval suite** | Regression tests that improve over time |
| **Feedback loop** | Failed runs become new eval cases and skill examples |

Box Forms has no public API. This system uses **browser automation** (cursor-ide-browser MCP) against the Box web UI (Relay → Forms).

## Quick start

### 1. Setup

```bash
cd "/Users/adarshsubramanian/Forms Creation Agent"
cp .env.example .env
# Edit .env: set BOX_DEMO_URL and CURSOR_API_KEY (for batch evals)

npm install
```

### 2. Interactive build (Cursor IDE)

1. Log into your Box demo instance in the browser.
2. In Cursor chat, invoke the builder subagent (grading runs automatically afterward):

   ```
   @box-forms-builder Create a contact form with name, email, and message fields
   ```

   The builder invokes the grader when the form is built — you do not need a separate grading step.

### 3. Validate a FormSpec

```bash
npm run validate-spec -- path/to/form-spec.json
```

### 4. Run eval suite (Cursor SDK)

```bash
npm run eval
# Dry run (no SDK calls):
npm run eval:dry
```

Reports are written to `data/runs/eval_report_<date>.json`.

### 5. Export a run for feedback (pilot participants)

```bash
npm run export-run -- --run-id <run_id>
```

Writes an anonymized JSON to `data/exports/` (no Box URLs). Submit via GitHub Issue — see [CONTRIBUTING.md](CONTRIBUTING.md).

### 6. Ingest feedback from a failed run (maintainers)

```bash
npm run ingest-feedback -- --run-id <run_id> [--corrected-spec path/to/fixed.json]
```

## Project structure

```
.cursor/
  agents/           # Builder and grader subagent definitions
  skills/box-forms/ # FormSpec schema, UI map, validation scripts
specs/              # JSON Schema for FormSpec
evals/              # Eval cases, rubric, golden specs
scripts/            # SDK eval runner, feedback ingestion, export
data/runs/          # Append-only run history (gitignored JSON artifacts)
data/exports/       # Anonymized exports for GitHub submission (gitignored)
```

## FormSpec workflow

```
Natural language prompt
        ↓
   FormSpec JSON  ← validate with validate_spec.py
        ↓
   Box web UI (browser automation)
        ↓
   Run artifact (data/runs/{run_id}.json)
        ↓
   Grader (L1 deterministic → L2 rubric → L3 visual)
```

## Credentials

| Variable | Required | Description |
|----------|----------|-------------|
| `BOX_DEMO_URL` | Yes | e.g. `https://your-enterprise.app.box.com` |
| `CURSOR_API_KEY` | For evals | Cursor SDK API key |
| `BOX_SESSION_FILE` | Optional | Saved session for headless runs |

Never commit `.env` or session files.

## Continuous improvement

1. Every build is logged to `data/runs/`.
2. Grader failures include actionable feedback.
3. Use `ingest-feedback` to promote corrections into `evals/cases.jsonl` and `evals/golden/`.
4. Update `evals/rubric.md` when the same failure repeats 3+ times.
5. Re-run `npm run eval` to measure pass-rate improvement.

See [docs/improvement-workflow.md](docs/improvement-workflow.md) for the full loop.

## Pilot program

Share the agent with a small cohort (5–15 users) to gather diverse prompts and grader signal.

### Prerequisites for participants

| Requirement | Required for interactive builds? |
|-------------|-------------------------------|
| Cursor IDE + browser MCP | Yes |
| Box demo account (`BOX_DEMO_URL`) | Yes |
| `CURSOR_API_KEY` | No — only for batch evals |

Each participant should use their **own Box demo account** — avoid shared concurrent browser automation.

### Starter prompts

Try these with `@box-forms-builder`:

1. **Contact form** — "Create a contact form with full name, email address, and message fields. All fields should be required."
2. **Onboarding with logic** — "Create an employee onboarding form with full name, start date, department dropdown (Engineering, Sales, Marketing, Other), and a conditional other department text field when Other is selected."
3. **Conditional benefits** — "Create a benefits enrollment form. Ask if enrolling in health insurance (Yes/No radio). If Yes, show dropdown for plan tier (Basic, Plus, Premium). If No, show a long text reason field."

### Submitting feedback

1. Export: `npm run export-run -- --run-id <run_id>`
2. Open a GitHub Issue using the **Eval contribution** template
3. Maintainers ingest curated submissions into `evals/` weekly

Full pilot playbook: [docs/pilot-kickoff.md](docs/pilot-kickoff.md)  
Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)

## GitHub

Local git is initialized. To create the remote and push:

```bash
gh auth login
npm run setup-github
```

See [docs/github-setup.md](docs/github-setup.md).

## Agents

- **box-forms-builder** — `.cursor/agents/box-forms-builder.md`
- **box-forms-grader** — `.cursor/agents/box-forms-grader.md`

## Eval categories

| Category | Cases |
|----------|-------|
| Simple intake | contact, feedback |
| HR / onboarding | new hire, PTO |
| Conditional logic | show/hide, enable/disable |
| File collection | upload + metadata |
| Branding | theme + logo |
| Edge / adversarial | ambiguous prompts, duplicate titles |

## Constraints

- **Unique form titles** — builder appends a timestamp suffix automatically.
- **Session expiry** — re-authenticate in browser when login page is detected.
- **No Forms API** — UI automation may be flaky; FormSpec validation runs before UI work.
