/**
 * Export an anonymized run artifact for sharing via GitHub Issue or PR.
 *
 * Strips Box URLs, screenshot paths, and session-related fields.
 * Keeps prompt, FormSpec, scores, and grader feedback for eval contributions.
 *
 * Usage:
 *   npx tsx scripts/export_run.ts --run-id <id> [--output path]
 *   npm run export-run -- --run-id <id>
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS_DIR = join(ROOT, "data/runs");
const EXPORTS_DIR = join(ROOT, "data/exports");

interface RunArtifact {
  run_id: string;
  source_prompt?: string;
  eval_case_id?: string;
  form_spec_path?: string;
  status?: string;
  scored?: {
    pass?: boolean;
    scores?: Record<string, number>;
    feedback?: string[];
    suggested_fixes?: string[];
    deterministic_failures?: string[];
    rubric_version?: string;
  };
  feedback?: string[];
  suggested_fixes?: string[];
  fields_created?: Array<{ label: string; type: string; required?: boolean }>;
  human_feedback?: {
    rating: number;
    comment?: string;
    grader_overall?: number;
    grader_human_delta?: number;
    disagreement_flag?: boolean;
    auto_ingested?: boolean;
  };
}

interface ExportPayload {
  export_version: "1.0";
  exported_at: string;
  run_id: string;
  status?: string;
  eval_case_id?: string;
  category?: string;
  prompt: string;
  form_spec: Record<string, unknown> | null;
  scores: Record<string, number> | null;
  pass: boolean | null;
  feedback: string[];
  suggested_fixes: string[];
  deterministic_failures: string[];
  rubric_version?: string;
  fields_created?: Array<{ label: string; type: string; required?: boolean }>;
  human_feedback?: {
    rating: number;
    comment?: string;
    grader_overall?: number;
    grader_human_delta?: number;
    disagreement_flag?: boolean;
  } | null;
  notes: string;
}

function parseArgs(): { runId: string; output: string | null } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const runId = get("--run-id");
  if (!runId) {
    console.error("Required: --run-id <run_id>");
    console.error("Example: npm run export-run -- --run-id 20260607-190104-contact");
    process.exit(1);
  }
  return { runId, output: get("--output") };
}

function loadRun(runId: string): RunArtifact {
  const path = join(RUNS_DIR, `${runId}.json`);
  if (!existsSync(path)) {
    console.error(`Run not found: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadFormSpec(run: RunArtifact, runId: string): Record<string, unknown> | null {
  const specPath = run.form_spec_path
    ? join(ROOT, run.form_spec_path)
    : join(RUNS_DIR, `${runId}.spec.json`);

  if (!existsSync(specPath)) return null;
  return JSON.parse(readFileSync(specPath, "utf-8"));
}

function inferCategory(run: RunArtifact): string | undefined {
  if (run.eval_case_id) {
    const casesPath = join(ROOT, "evals/cases.jsonl");
    if (!existsSync(casesPath)) return undefined;
    for (const line of readFileSync(casesPath, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const c = JSON.parse(line);
        if (c.id === run.eval_case_id) return c.category;
      } catch {
        /* skip malformed lines */
      }
    }
  }
  return undefined;
}

function buildExport(runId: string, run: RunArtifact): ExportPayload {
  const scored = run.scored;
  const feedback = scored?.feedback ?? run.feedback ?? [];
  const suggestedFixes = scored?.suggested_fixes ?? run.suggested_fixes ?? [];

  return {
    export_version: "1.0",
    exported_at: new Date().toISOString(),
    run_id: runId,
    status: run.status,
    eval_case_id: run.eval_case_id,
    category: inferCategory(run),
    prompt: run.source_prompt || "(no prompt recorded)",
    form_spec: loadFormSpec(run, runId),
    scores: scored?.scores ?? null,
    pass: scored?.pass ?? null,
    feedback,
    suggested_fixes: suggestedFixes,
    deterministic_failures: scored?.deterministic_failures ?? [],
    rubric_version: scored?.rubric_version,
    fields_created: run.fields_created,
    human_feedback: run.human_feedback
      ? {
          rating: run.human_feedback.rating,
          comment: run.human_feedback.comment,
          grader_overall: run.human_feedback.grader_overall,
          grader_human_delta: run.human_feedback.grader_human_delta,
          disagreement_flag: run.human_feedback.disagreement_flag,
        }
      : null,
    notes:
      "Anonymized export — Box URLs and screenshot paths removed. " +
      "Submit via GitHub Issue (Eval contribution template) or PR.",
  };
}

function main(): void {
  const { runId, output } = parseArgs();
  const run = loadRun(runId);
  const payload = buildExport(runId, run);

  mkdirSync(EXPORTS_DIR, { recursive: true });
  const outPath = output || join(EXPORTS_DIR, `${runId}.export.json`);
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");

  console.log(`Exported anonymized run: ${outPath}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Review the export for any sensitive content");
  console.log("  2. Open a GitHub Issue using the Eval contribution template");
  console.log("  3. Paste the JSON or attach the export file");
}

main();
