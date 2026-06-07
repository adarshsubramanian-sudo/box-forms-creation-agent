#!/usr/bin/env bash
# Create GitHub remote and push (requires: gh auth login)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPO_NAME="${1:-box-forms-creation-agent}"
VISIBILITY="${2:-private}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run: gh auth login"
  echo "Then re-run: npm run setup-github -- [repo-name] [private|public]"
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote 'origin' already exists:"
  git remote get-url origin
  exit 0
fi

echo "Creating ${VISIBILITY} repo: ${REPO_NAME}"
gh repo create "$REPO_NAME" \
  --"${VISIBILITY}" \
  --source=. \
  --remote=origin \
  --description "Box Forms builder + grader agents with eval suite and feedback loop"

git push -u origin main
echo ""
echo "Done. Remote: $(git remote get-url origin)"
