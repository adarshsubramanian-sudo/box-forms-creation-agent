import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import type { RunArtifact } from "./types.js";

export const EXPORTS_DIR = "data/exports";
export const RUNS_DIR = "data/runs";

export interface ExportPayload {
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

export function loadRun(root: string, runId: string): RunArtifact {
  const path = join(root, RUNS_DIR, `${runId}.json`);
  if (!existsSync(path)) {
    throw new Error(`Run not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadFormSpec(
  root: string,
  run: RunArtifact,
  runId: string,
): Record<string, unknown> | null {
  const specPath = run.form_spec_path
    ? join(root, run.form_spec_path)
    : join(root, RUNS_DIR, `${runId}.spec.json`);

  if (!existsSync(specPath)) return null;
  return JSON.parse(readFileSync(specPath, "utf-8"));
}

function inferCategory(root: string, run: RunArtifact): string | undefined {
  if (!run.eval_case_id) return undefined;
  const casesPath = join(root, "evals/cases.jsonl");
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
  return undefined;
}

export function buildExport(
  root: string,
  runId: string,
  run: RunArtifact,
): ExportPayload {
  const scored = run.scored;
  const feedback = scored?.feedback ?? run.feedback ?? [];
  const suggestedFixes = scored?.suggested_fixes ?? run.suggested_fixes ?? [];

  return {
    export_version: "1.0",
    exported_at: new Date().toISOString(),
    run_id: runId,
    status: run.status,
    eval_case_id: run.eval_case_id,
    category: inferCategory(root, run),
    prompt: run.source_prompt || "(no prompt recorded)",
    form_spec: loadFormSpec(root, run, runId),
    scores: scored?.scores ?? null,
    pass: scored?.pass ?? null,
    feedback,
    suggested_fixes: suggestedFixes,
    deterministic_failures: scored?.deterministic_failures ?? [],
    rubric_version: scored?.rubric_version,
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

export function writeExport(
  root: string,
  runId: string,
  outputPath?: string,
): string {
  const run = loadRun(root, runId);
  const payload = buildExport(root, runId, run);
  const exportsDir = join(root, EXPORTS_DIR);
  mkdirSync(exportsDir, { recursive: true });
  const outPath = outputPath || join(exportsDir, `${runId}.export.json`);
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
  return outPath;
}

/** Normalize --since to YYYYMMDD prefix for run_id matching. */
export function normalizeSinceDate(since: string): string {
  const digits = since.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(0, 8);
  throw new Error(`Invalid --since date: ${since} (use YYYY-MM-DD or YYYYMMDD)`);
}

const SKIP_RUN_FILES = new Set(["ratings_summary.json"]);

/** List run IDs from data/runs/*.json, optionally filtered by date prefix. */
export function listRunIds(root: string, sincePrefix?: string): string[] {
  const runsPath = join(root, RUNS_DIR);
  if (!existsSync(runsPath)) return [];

  const ids: string[] = [];
  for (const file of readdirSync(runsPath)) {
    if (!file.endsWith(".json")) continue;
    if (file.endsWith(".spec.json") || SKIP_RUN_FILES.has(file)) continue;
    if (file.startsWith("eval_report_")) continue;
    const runId = file.replace(/\.json$/, "");
    if (sincePrefix && !runId.startsWith(sincePrefix)) continue;
    ids.push(runId);
  }
  return ids.sort();
}
