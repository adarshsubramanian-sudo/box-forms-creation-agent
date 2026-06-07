#!/usr/bin/env node
/** Sync evals/expected/*.json from evals/cases.jsonl */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CASES_PATH = join(ROOT, "evals/cases.jsonl");
const EXPECTED_DIR = join(ROOT, "evals/expected");

interface EvalCase {
  id: string;
  category: string;
  prompt: string;
  expected: Record<string, unknown>;
}

function loadCases(): EvalCase[] {
  const lines = readFileSync(CASES_PATH, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => JSON.parse(line) as EvalCase);
}

function syncExpected(): void {
  mkdirSync(EXPECTED_DIR, { recursive: true });
  const cases = loadCases();
  const ids = new Set(cases.map((c) => c.id));

  for (const c of cases) {
    const outPath = join(EXPECTED_DIR, `${c.id}.json`);
    writeFileSync(outPath, JSON.stringify(c.expected, null, 2) + "\n");
  }

  for (const file of readdirSync(EXPECTED_DIR)) {
    if (!file.endsWith(".json")) continue;
    const id = file.replace(/\.json$/, "");
    if (!ids.has(id)) {
      console.warn(`Stale expected file (no matching case): ${file}`);
    }
  }

  console.log(`Synced ${cases.length} expected files to evals/expected/`);
}

syncExpected();
