# GitHub setup

The repo is initialized locally on `main`. Push to GitHub with the steps below.

## 1. Authenticate GitHub CLI

```bash
gh auth login
```

Choose GitHub.com, HTTPS, and authenticate via browser.

## 2. Create remote and push

Default (private repo named `box-forms-creation-agent`):

```bash
npm run setup-github
```

Custom name or visibility:

```bash
npm run setup-github -- my-repo-name private
npm run setup-github -- my-repo-name public
```

This runs [`scripts/setup_github_remote.sh`](../scripts/setup_github_remote.sh), which:

1. Creates the GitHub repository
2. Adds `origin` remote
3. Pushes `main`

## Manual alternative

```bash
gh repo create box-forms-creation-agent --private --source=. --remote=origin
git push -u origin main
```

## Verify

```bash
git remote -v
gh repo view --web
```

## What is not pushed

Per [`.gitignore`](../.gitignore):

- `.env` and Box session files
- `node_modules/`
- `data/runs/*.json`, `*.jsonl`, `*.png` (local run artifacts)
- `data/exports/` (local anonymized exports)

Only curated eval additions in `evals/` should be committed after maintainer review.
