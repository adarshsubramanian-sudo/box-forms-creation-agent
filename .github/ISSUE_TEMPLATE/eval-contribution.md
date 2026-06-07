---
name: Eval contribution
about: Submit a graded run to improve the Box Forms eval suite
title: "[Eval] "
labels: eval-contribution
assignees: ''
---

## Summary

Briefly describe what you tried and whether the result matched your intent.

## Run details

- **Run ID:** (from `data/runs/{run_id}.json`)
- **Pass / fail:** (from grader output)
- **Human rating (1–10):** (from builder prompt or export JSON)
- **Category:** (e.g. conditional_logic, branding, edge_case — or "custom")

## Source prompt

```
Paste the exact prompt you gave @box-forms-builder
```

## Export JSON

Export locally before submitting:

```bash
npm run export-run -- --run-id <run_id>
# multiple runs:
npm run export-runs -- --run-ids <id1>,<id2>
npm run create-eval-issue -- --run-ids <id1>,<id2> [--summary "Pilot week 1"]
```

Paste the contents of `data/exports/{run_id}.export.json` below, or attach the file.

<details>
<summary>Click to paste export JSON</summary>

```json
(paste anonymized export here)
```

</details>

## Corrected FormSpec (optional)

If you fixed the form manually, paste the corrected FormSpec JSON here. Maintainers may promote it to `evals/golden/`.

<details>
<summary>Click to paste corrected FormSpec</summary>

```json

```

</details>

## What went wrong / what was good

- 
- 

## Consent

- [ ] I confirm this export contains no credentials, session data, or internal URLs I should not share
- [ ] I agree this submission may be used to improve the shared eval suite
