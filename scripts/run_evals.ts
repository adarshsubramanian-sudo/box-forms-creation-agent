/**
 * Box Forms eval suite runner.
 *
 * Usage:
 *   npx tsx scripts/run_evals.ts [--dry-run] [--case id] [--limit N]
 *
 * Requires CURSOR_API_KEY for live runs. Dry-run validates cases and writes plan only.
 */

import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CASES_PATH = join(ROOT, "evals/cases.jsonl");
const RUNS_DIR = join(ROOT, "data/runs");
const RUNS_LOG = join(RUNS_DIR, "runs.jsonl");

interface EvalCase {
  id: string;
  category: string;
  prompt: string;
  expected: Record<string, unknown>;
}

interface CaseResult {
  case_id: string;
  category: string;
  run_id: string | null;
  status: "pass" | "fail" | "error" | "skipped" | "planned";
  scores?: Record<string, number>;
  error?: string;
  dry_run: boolean;
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return env;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function loadCases(): EvalCase[] {
  return readFileSync(CASES_PATH, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EvalCase);
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function buildBuilderPrompt(c: EvalCase, runId: string): string {
  return [
    "You are running in EVAL MODE as the box-forms-builder agent.",
    "Read and follow: .cursor/agents/box-forms-builder.md and .cursor/skills/box-forms/SKILL.md",
    "",
    `Eval case id: ${c.id}`,
    `Run id: ${runId}`,
    `Category: ${c.category}`,
    "",
    "Prompt:",
    c.prompt,
    "",
    "After building:",
    `1. Save spec to data/runs/${runId}.spec.json`,
    `2. Save run artifact to data/runs/${runId}.json with eval_case_id set`,
    `3. Validate against evals/expected/${c.id}.json`,
    "4. Do NOT grade — the orchestrator will invoke the grader next.",
  ].join("\n");
}

function buildGraderPrompt(runId: string, caseId: string): string {
  return [
    "You are running in EVAL MODE as the box-forms-grader agent.",
    "Read and follow: .cursor/agents/box-forms-grader.md and evals/rubric.md",
    "",
    `Grade run: data/runs/${runId}.json`,
    `Eval case id: ${caseId}`,
    "",
    "Apply L1, L2, L3 scoring. Run score_run.py --write.",
    "Set rubric_version from evals/rubric.md.",
  ].join("\n");
}

function validateGoldenSpec(caseId: string): string[] {
  const goldenPath = join(ROOT, "evals/golden", `${caseId}.json`);
  if (!existsSync(goldenPath)) return [];
  const result = spawnSync(
    "python3",
    [
      join(ROOT, ".cursor/skills/box-forms/scripts/validate_spec.py"),
      goldenPath,
      "--json",
    ],
    { encoding: "utf-8", cwd: ROOT }
  );
  if (result.status !== 0) {
    try {
      const parsed = JSON.parse(result.stdout || "{}");
      return parsed.schema_errors ?? ["Golden spec validation failed"];
    } catch {
      return [result.stderr || "Golden spec validation failed"];
    }
  }
  return [];
}

async function runWithSdk(
  prompt: string,
  env: Record<string, string>
): Promise<{ status: string; error?: string }> {
  const apiKey = env.CURSOR_API_KEY || process.env.CURSOR_API_KEY;
  if (!apiKey) {
    return { status: "error", error: "CURSOR_API_KEY not set" };
  }

  try {
    const { Agent, CursorAgentError } = await import("@cursor/sdk");
    const modelId = env.CURSOR_MODEL || process.env.CURSOR_MODEL || "composer-2.5";

    await using agent = await Agent.create({
      apiKey,
      model: { id: modelId },
      local: { cwd: ROOT },
    });

    const run = await agent.send(prompt);
    const result = await run.wait();
    return { status: result.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", error: message };
  }
}

function readRunScore(runId: string): Record<string, number> | undefined {
  const runPath = join(RUNS_DIR, `${runId}.json`);
  if (!existsSync(runPath)) return undefined;
  const run = JSON.parse(readFileSync(runPath, "utf-8"));
  return run.scored?.scores ?? run.scores;
}

function appendRunLog(entry: Record<string, unknown>): void {
  appendFileSync(RUNS_LOG, JSON.stringify(entry) + "\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const caseFilter = args.includes("--case")
    ? args[args.indexOf("--case") + 1]
    : null;
  const limitArg = args.includes("--limit")
    ? parseInt(args[args.indexOf("--limit") + 1], 10)
    : null;

  // Sync expected files first
  spawnSync("npx", ["tsx", "scripts/sync_expected.ts"], {
    cwd: ROOT,
    stdio: "inherit",
  });

  mkdirSync(RUNS_DIR, { recursive: true });
  const env = loadEnv();
  const passThreshold = parseFloat(
    env.EVAL_PASS_THRESHOLD || process.env.EVAL_PASS_THRESHOLD || "0.8"
  );

  let cases = loadCases();
  if (caseFilter) {
    cases = cases.filter((c) => c.id === caseFilter);
    if (cases.length === 0) {
      console.error(`No case found with id: ${caseFilter}`);
      process.exit(1);
    }
  }
  if (limitArg && limitArg > 0) {
    cases = cases.slice(0, limitArg);
  }

  console.log(
    `Running ${cases.length} eval case(s)${dryRun ? " (dry-run)" : ""}...`
  );

  const results: CaseResult[] = [];
  const goldenErrors: Record<string, string[]> = {};

  for (const c of cases) {
    const goldenErrs = validateGoldenSpec(c.id);
    if (goldenErrs.length) goldenErrors[c.id] = goldenErrs;

    const runId = `${timestampSlug()}-${c.id}`;

    if (dryRun) {
      results.push({
        case_id: c.id,
        category: c.category,
        run_id: runId,
        status: "planned",
        dry_run: true,
      });
      continue;
    }

    console.log(`\n--- Case: ${c.id} (${c.category}) ---`);

    const builderResult = await runWithSdk(buildBuilderPrompt(c, runId), env);
    if (builderResult.status === "error") {
      results.push({
        case_id: c.id,
        category: c.category,
        run_id: runId,
        status: "error",
        error: builderResult.error,
        dry_run: false,
      });
      continue;
    }

    const graderResult = await runWithSdk(buildGraderPrompt(runId, c.id), env);
    if (graderResult.status === "error") {
      results.push({
        case_id: c.id,
        category: c.category,
        run_id: runId,
        status: "error",
        error: graderResult.error,
        dry_run: false,
      });
      continue;
    }

    const scores = readRunScore(runId);
    const overall = scores?.overall ?? 0;
    const pass = overall >= passThreshold;

    results.push({
      case_id: c.id,
      category: c.category,
      run_id: runId,
      status: pass ? "pass" : "fail",
      scores,
      dry_run: false,
    });

    appendRunLog({
      type: "eval_result",
      case_id: c.id,
      run_id: runId,
      pass,
      scores,
      at: new Date().toISOString(),
    });
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const errors = results.filter((r) => r.status === "error").length;
  const planned = results.filter((r) => r.status === "planned").length;

  const report = {
    generated_at: new Date().toISOString(),
    dry_run: dryRun,
    pass_threshold: passThreshold,
    summary: {
      total: results.length,
      passed,
      failed,
      errors,
      planned,
      pass_rate: results.length
        ? (passed / (passed + failed + errors || 1)).toFixed(3)
        : "0.000",
    },
    golden_validation_errors: goldenErrors,
    by_category: groupByCategory(results),
    results,
  };

  const reportName = `eval_report_${timestampSlug()}.json`;
  const reportPath = join(RUNS_DIR, reportName);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  console.log("\n=== Eval Report ===");
  console.log(`Report: ${reportPath}`);
  console.log(JSON.stringify(report.summary, null, 2));

  if (!dryRun && failed + errors > 0) process.exit(1);
}

function groupByCategory(
  results: CaseResult[]
): Record<string, CaseResult[]> {
  const out: Record<string, CaseResult[]> = {};
  for (const r of results) {
    (out[r.category] ??= []).push(r);
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
