/**
 * Promote a failed run (and optional human correction) into the eval suite.
 *
 * Usage:
 *   npx tsx scripts/ingest_feedback.ts --run-id <id> [--corrected-spec path] [--promote-golden]
 */

import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CASES_PATH = join(ROOT, "evals/cases.jsonl");
const GOLDEN_DIR = join(ROOT, "evals/golden");
const EXPECTED_DIR = join(ROOT, "evals/expected");
const FEEDBACK_LOG = join(ROOT, "data/runs/feedback.jsonl");
const RUNS_DIR = join(ROOT, "data/runs");

interface RunArtifact {
  run_id: string;
  source_prompt?: string;
  eval_case_id?: string;
  form_spec_path?: string;
  scored?: { pass?: boolean; feedback?: string[]; suggested_fixes?: string[] };
  feedback?: string[];
  suggested_fixes?: string[];
}

function parseArgs(): {
  runId: string;
  correctedSpec: string | null;
  promoteGolden: boolean;
  newCaseId: string | null;
} {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const runId = get("--run-id");
  if (!runId) {
    console.error("Required: --run-id <run_id>");
    process.exit(1);
  }
  return {
    runId,
    correctedSpec: get("--corrected-spec"),
    promoteGolden: args.includes("--promote-golden"),
    newCaseId: get("--new-case-id"),
  };
}

function loadRun(runId: string): RunArtifact {
  const path = join(RUNS_DIR, `${runId}.json`);
  if (!existsSync(path)) {
    console.error(`Run not found: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function inferExpectedFromSpec(
  spec: Record<string, unknown>
): Record<string, unknown> {
  const fields = (spec.fields as unknown[]) ?? [];
  const expected: Record<string, unknown> = {
    min_fields: fields.length,
  };
  const required = (fields as Array<{ label?: string; required?: boolean }>)
    .filter((f) => f.required && f.label)
    .map((f) => f.label as string);
  if (required.length) expected.required_fields = required;
  const logic = (spec.logic as unknown[]) ?? [];
  if (logic.length) expected.must_have_logic = true;
  const branding = spec.branding as Record<string, unknown> | undefined;
  if (branding?.theme_color) expected.must_have_branding = true;
  return expected;
}

function validateSpec(path: string): boolean {
  const result = spawnSync(
    "python3",
    [
      join(ROOT, ".cursor/skills/box-forms/scripts/validate_spec.py"),
      path,
      "--json",
    ],
    { encoding: "utf-8", cwd: ROOT }
  );
  if (result.status === 0) return true;
  console.error("Spec validation failed:", result.stdout || result.stderr);
  return false;
}

function main(): void {
  const { runId, correctedSpec, promoteGolden, newCaseId } = parseArgs();
  const run = loadRun(runId);

  mkdirSync(GOLDEN_DIR, { recursive: true });
  mkdirSync(EXPECTED_DIR, { recursive: true });

  const specPath =
    correctedSpec ||
    (run.form_spec_path
      ? join(ROOT, run.form_spec_path)
      : join(RUNS_DIR, `${runId}.spec.json`));

  if (!existsSync(specPath)) {
    console.error(`FormSpec not found: ${specPath}`);
    process.exit(1);
  }

  if (!validateSpec(specPath)) process.exit(1);

  const spec = JSON.parse(readFileSync(specPath, "utf-8"));
  const caseId =
    newCaseId ||
    run.eval_case_id ||
    `feedback-${slugify(run.source_prompt || runId)}`;

  const evalCase = {
    id: caseId,
    category: "from_feedback",
    prompt: run.source_prompt || `Feedback case from run ${runId}`,
    expected: inferExpectedFromSpec(spec),
    source_run_id: runId,
    ingested_at: new Date().toISOString(),
  };

  appendFileSync(CASES_PATH, JSON.stringify(evalCase) + "\n");
  writeFileSync(
    join(EXPECTED_DIR, `${caseId}.json`),
    JSON.stringify(evalCase.expected, null, 2) + "\n"
  );

  if (promoteGolden) {
    const goldenPath = join(GOLDEN_DIR, `${caseId}.json`);
    writeFileSync(goldenPath, JSON.stringify(spec, null, 2) + "\n");
    console.log(`Promoted golden spec: ${goldenPath}`);
  }

  const feedbackEntry = {
    run_id: runId,
    new_case_id: caseId,
    corrected_spec: basename(specPath),
    promote_golden: promoteGolden,
    original_feedback: run.scored?.feedback ?? run.feedback ?? [],
    original_fixes: run.scored?.suggested_fixes ?? run.suggested_fixes ?? [],
    ingested_at: new Date().toISOString(),
  };

  appendFileSync(FEEDBACK_LOG, JSON.stringify(feedbackEntry) + "\n");

  // Mark run as ingested
  run.scored = {
    ...run.scored,
    ingested: true,
    ingested_case_id: caseId,
  } as RunArtifact["scored"];
  writeFileSync(
    join(RUNS_DIR, `${runId}.json`),
    JSON.stringify(run, null, 2) + "\n"
  );

  console.log(`Ingested feedback from run ${runId}`);
  console.log(`New eval case: ${caseId}`);
  console.log(`Expected: evals/expected/${caseId}.json`);
  console.log(`Feedback log: ${FEEDBACK_LOG}`);
}

main();
