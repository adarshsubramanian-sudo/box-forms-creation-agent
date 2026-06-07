---
name: box-forms
description: >-
  Build and validate Box Forms from natural language using FormSpec JSON and
  browser automation in the Box web UI (Relay → Forms). Use when creating Box
  Forms, validating form specs, configuring conditional logic, or automating
  the Box Forms builder. Covers field types, branding, logic rules, and UI steps.
---

# Box Forms Builder Skill

## Workflow

1. **Parse** the user prompt into a FormSpec JSON object (see schema below).
2. **Validate** before any browser work:
   ```bash
   python3 .cursor/skills/box-forms/scripts/validate_spec.py /path/to/spec.json
   ```
3. **Materialize** the spec in Box via browser automation (Relay → Forms).
4. **Save** run artifact to `data/runs/{run_id}.json`.
5. **Grade** — builder always invokes `@box-forms-grader` (via Task) before finishing; grading is not optional.
6. **Rate** — builder asks user for 1–10 rating + optional comment, runs `npm run record-rating`.

Only proceed to browser automation when validation passes.

## FormSpec schema (summary)

Full JSON Schema: [specs/form-spec.schema.json](../../specs/form-spec.schema.json)

### Required top-level fields

| Field | Description |
|-------|-------------|
| `title` | Unique form title. Append `-YYYYMMDD-HHMMSS` suffix to avoid duplicates. |
| `fields` | Non-empty array of field objects |

### Field types (Box Forms)

| FormSpec type | Box UI label |
|---------------|--------------|
| `short_text` | Short Text |
| `long_text` | Long Text |
| `checkbox` | Checkbox |
| `radio` | Radio |
| `dropdown` | Dropdown |
| `number` | Number |
| `file_upload` | File Upload |
| `email` | Email Address |
| `metadata` | Metadata |

### Field object

```json
{
  "id": "full_name",
  "type": "short_text",
  "label": "Full Name",
  "required": true,
  "placeholder": "Jane Doe"
}
```

Choice fields (`radio`, `dropdown`, `checkbox`) require `options`:

```json
"options": [
  { "value": "engineering", "label": "Engineering" },
  { "value": "other", "label": "Other" }
]
```

### Conditional logic

```json
{
  "id": "show_other_dept",
  "match": "all",
  "conditions": [
    { "field_id": "department", "operator": "equals", "value": "other" }
  ],
  "outcome": "show",
  "target_field_ids": ["other_department"]
}
```

Outcomes: `show`, `hide`, `enable`, `disable`.  
Operators: `equals`, `not_equals`, `contains`, `not_contains`, `is_empty`, `is_not_empty`, `greater_than`, `less_than`.

### Branding

```json
"branding": {
  "theme_color": "#0061D5",
  "header_logo_url": "https://example.com/logo.png"
}
```

## Browser automation steps

Read [reference.md](reference.md) for the full UI map.

1. Navigate to `{BOX_DEMO_URL}` from `.env`.
2. If login page detected → stop and ask user to authenticate.
3. Go to **Relay** → **Forms** tab.
4. Click **New +**.
5. Set form title (unique).
6. Add each field per spec (type, label, required, options).
7. Add logic rules if spec includes `logic`.
8. Apply branding if specified.
9. Open **Preview**, capture screenshot.
10. Write run artifact.

## Run artifact format

Save to `data/runs/{run_id}.json`:

```json
{
  "run_id": "20260607-143022-contact",
  "status": "completed",
  "source_prompt": "...",
  "form_spec_path": "data/runs/20260607-143022-contact.spec.json",
  "box_form_url": "https://...",
  "screenshot_path": "data/runs/20260607-143022-contact.png",
  "started_at": "2026-06-07T14:30:22Z",
  "completed_at": "2026-06-07T14:32:10Z"
}
```

### Human feedback (after user rates)

```json
"human_feedback": {
  "rating": 7,
  "comment": "Missing conditional logic for Other department",
  "collected_at": "2026-06-07T20:00:00Z",
  "grader_overall": 0.9875,
  "grader_human_delta": 0.2875,
  "auto_ingested": true,
  "auto_ingested_case_id": "human-rating-20260607-143022-contact"
}
```

Append rating events to `data/runs/ratings.jsonl`.

## Human rating (Step 7)

After grading, the builder **must** ask:

> How would you rate the form built by the agent on a scale of 1 to 10 (10 = best, 1 = worst)?

Then optionally: *"Any additional feedback?"*

Persist with:

```bash
npm run record-rating -- --run-id {run_id} --rating {1-10} [--comment "..."]
```

Learning loop triggers (see `.env` thresholds):
- Rating ≤ 6 → auto-ingest eval case from prompt (no bad golden)
- Rating ≥ 9 + grader pass → auto-ingest + promote golden spec

Skip for batch eval runs (`eval_case_id` set) or when `human_feedback` already exists.

## Sharing runs (Step 8)

After rating, the builder offers to export for sharing. Commands:

```bash
npm run export-run -- --run-id {run_id}
npm run export-runs -- --run-ids {id1},{id2}   # or --since YYYY-MM-DD
npm run create-eval-issue -- --run-ids {ids} [--summary "..."] [--create]
```

## Examples

### Example 1: Simple contact form

**Prompt:** "Create a contact form with name, email, and message."

**FormSpec:**

```json
{
  "title": "Contact Us-20260607-143000",
  "description": "General contact form",
  "fields": [
    { "id": "full_name", "type": "short_text", "label": "Full Name", "required": true },
    { "id": "email", "type": "email", "label": "Email Address", "required": true },
    { "id": "message", "type": "long_text", "label": "Message", "required": true }
  ]
}
```

### Example 2: Conditional logic

**Prompt:** "Department dropdown; if Other, show a text field for department name."

```json
{
  "title": "Employee Onboarding-20260607-143000",
  "fields": [
    { "id": "full_name", "type": "short_text", "label": "Full Name", "required": true },
    {
      "id": "department",
      "type": "dropdown",
      "label": "Department",
      "required": true,
      "options": [
        { "value": "engineering", "label": "Engineering" },
        { "value": "sales", "label": "Sales" },
        { "value": "other", "label": "Other" }
      ]
    },
    {
      "id": "other_department",
      "type": "short_text",
      "label": "Other Department",
      "required": false
    }
  ],
  "logic": [
    {
      "id": "show_other_dept",
      "match": "all",
      "conditions": [
        { "field_id": "department", "operator": "equals", "value": "other" }
      ],
      "outcome": "show",
      "target_field_ids": ["other_department"]
    }
  ]
}
```

## Error handling

| Situation | Action |
|-----------|--------|
| Validation fails | Fix FormSpec, re-validate, do not open browser |
| Login page | Ask user to log in, retry |
| Duplicate title error | Append new timestamp suffix to title |
| Field type not in palette | Use closest type; note in run artifact |
| Browser timeout | Retry once; if still failing, save partial run as `status: partial` |

## Additional reference

- UI map and field catalog: [reference.md](reference.md)
- Grading rubric: [evals/rubric.md](../../evals/rubric.md)
- Golden specs: [evals/golden/](../../evals/golden/)
