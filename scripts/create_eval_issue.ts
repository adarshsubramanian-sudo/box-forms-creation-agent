/**
 * Scaffold a GitHub Eval contribution issue from one or more exported runs.
 *
 * Usage:
 *   npm run create-eval-issue -- --run-ids id1,id2 [--summary "Pilot week 1 feedback"]
 *   npm run create-eval-issue -- --exports path1.export.json,path2.export.json
 *   npm run create-eval-issue -- --run-ids id1 --create   (submit via gh CLI)
 *
 * Default: writes draft to data/exports/eval-issue-draft.md
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPORTS_DIR,
  type ExportPayload,
  listRunIds,
  normalizeSinceDate,
  writeExport,
} from "./lib/export.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

interface ParsedArgs {
  runIds: string[];
  exportPaths: string[];
  since: string | null;
  summary: string | null;
  output: string | null;
  create: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const has = (flag: string) => args.includes(flag);

  const runIdsArg = get("--run-ids");
  const exportsArg = get("--exports");
  const since = get("--since");

  const runIds = runIdsArg
    ? runIdsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const exportPaths = exportsArg
    ? exportsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (runIds.length === 0 && exportPaths.length === 0 && !since) {
    console.error("Required: --run-ids <id1,id2,...>, --exports <path,...>, and/or --since <date>");
    console.error("");
    console.error("Examples:");
    console.error("  npm run create-eval-issue -- --run-ids 20260607-190104-contact");
    console.error("  npm run create-eval-issue -- --run-ids id1,id2 --summary \"Pilot week 1\"");
    console.error("  npm run create-eval-issue -- --since 2026-06-07 --create");
    process.exit(1);
  }

  return {
    runIds,
    exportPaths,
    since,
    summary: get("--summary"),
    output: get("--output"),
    create: has("--create"),
  };
}

function resolveRunIds(args: ParsedArgs): string[] {
  const ids = new Set<string>(args.runIds);
  if (args.since) {
    const prefix = normalizeSinceDate(args.since);
    for (const id of listRunIds(ROOT, prefix)) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

function loadExportPayload(path: string): ExportPayload {
  const resolved = path.startsWith("/") ? path : join(ROOT, path);
  if (!existsSync(resolved)) {
    throw new Error(`Export not found: ${resolved}`);
  }
  return JSON.parse(readFileSync(resolved, "utf-8"));
}

function ensureExports(runIds: string[]): ExportPayload[] {
  const payloads: ExportPayload[] = [];

  for (const runId of runIds) {
    const exportPath = join(ROOT, EXPORTS_DIR, `${runId}.export.json`);
    if (!existsSync(exportPath)) {
      writeExport(ROOT, runId);
    }
    payloads.push(loadExportPayload(exportPath));
  }

  return payloads;
}

function passLabel(pass: boolean | null): string {
  if (pass === true) return "pass";
  if (pass === false) return "fail";
  return "unknown";
}

function buildIssueBody(payloads: ExportPayload[], summary: string | null): string {
  const multi = payloads.length > 1;
  const lines: string[] = [];

  lines.push("## Summary");
  lines.push("");
  if (summary) {
    lines.push(summary);
  } else if (multi) {
    lines.push(
      `Batch submission of ${payloads.length} graded runs from the Box Forms builder pilot.`,
    );
  } else {
    const p = payloads[0];
    lines.push(
      `Graded run \`${p.run_id}\` — ${passLabel(p.pass)} (rating: ${p.human_feedback?.rating ?? "n/a"}/10).`,
    );
  }
  lines.push("");

  if (multi) {
    lines.push("## Run summary");
    lines.push("");
    lines.push("| Run ID | Pass | Rating | Category |");
    lines.push("|--------|------|--------|----------|");
    for (const p of payloads) {
      lines.push(
        `| \`${p.run_id}\` | ${passLabel(p.pass)} | ${p.human_feedback?.rating ?? "n/a"} | ${p.category ?? "custom"} |`,
      );
    }
    lines.push("");
  }

  for (const p of payloads) {
    lines.push(`## Run details${multi ? `: ${p.run_id}` : ""}`);
    lines.push("");
    lines.push(`- **Run ID:** \`${p.run_id}\``);
    lines.push(`- **Pass / fail:** ${passLabel(p.pass)}`);
    lines.push(
      `- **Human rating (1–10):** ${p.human_feedback?.rating ?? "(not recorded)"}`,
    );
    lines.push(`- **Category:** ${p.category ?? "custom"}`);
    lines.push("");

    lines.push("## Source prompt");
    lines.push("");
    lines.push("```");
    lines.push(p.prompt);
    lines.push("```");
    lines.push("");

    if (p.feedback.length > 0 || p.suggested_fixes.length > 0) {
      lines.push("## What went wrong / what was good");
      lines.push("");
      for (const item of p.feedback) {
        lines.push(`- ${item}`);
      }
      for (const fix of p.suggested_fixes) {
        lines.push(`- Suggested fix: ${fix}`);
      }
      lines.push("");
    }

    lines.push("## Export JSON");
    lines.push("");
    lines.push("<details>");
    lines.push(`<summary>Export JSON — ${p.run_id}</summary>`);
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(p, null, 2));
    lines.push("```");
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push("## Consent");
  lines.push("");
  lines.push(
    "- [ ] I confirm this export contains no credentials, session data, or internal URLs I should not share",
  );
  lines.push(
    "- [ ] I agree this submission may be used to improve the shared eval suite",
  );

  return lines.join("\n");
}

function buildIssueTitle(payloads: ExportPayload[], summary: string | null): string {
  if (summary) {
    return `[Eval] ${summary}`;
  }
  if (payloads.length === 1) {
    const p = payloads[0];
    const slug = p.run_id.split("-").slice(2).join("-") || p.run_id;
    return `[Eval] ${slug} (${passLabel(p.pass)}, ${p.human_feedback?.rating ?? "?"} /10)`;
  }
  return `[Eval] Batch submission (${payloads.length} runs)`;
}

function createWithGh(title: string, body: string, bodyPath: string): void {
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch {
    console.error("GitHub CLI (gh) is not installed. Install from https://cli.github.com/");
    console.error("Or submit the draft manually via GitHub Issues → Eval contribution.");
    process.exit(1);
  }

  const url = execSync(
    `gh issue create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(bodyPath)} --label eval-contribution`,
    { encoding: "utf-8", cwd: ROOT },
  ).trim();

  console.log(`Created GitHub issue: ${url}`);
}

function main(): void {
  const args = parseArgs();
  const runIds = resolveRunIds(args);

  let payloads: ExportPayload[] = [];

  if (args.exportPaths.length > 0) {
    payloads = args.exportPaths.map(loadExportPayload);
  }

  if (runIds.length > 0) {
    payloads = [...payloads, ...ensureExports(runIds)];
  }

  // Deduplicate by run_id
  const seen = new Set<string>();
  payloads = payloads.filter((p) => {
    if (seen.has(p.run_id)) return false;
    seen.add(p.run_id);
    return true;
  });

  if (payloads.length === 0) {
    console.error("No exports found for the given filters.");
    process.exit(1);
  }

  const title = buildIssueTitle(payloads, args.summary);
  const body = buildIssueBody(payloads, args.summary);
  const defaultOut = join(ROOT, EXPORTS_DIR, "eval-issue-draft.md");
  const outPath = args.output ? join(ROOT, args.output) : defaultOut;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, body + "\n");

  console.log(`Issue title: ${title}`);
  console.log(`Draft written: ${outPath}`);
  console.log("");
  console.log("Review the draft, then either:");
  console.log("  • Open GitHub Issues → Eval contribution and paste the draft");
  console.log(`  • npm run create-eval-issue -- --exports ${payloads.map((p) => join(EXPORTS_DIR, `${p.run_id}.export.json`)).join(",")} --create`);

  if (args.create) {
    createWithGh(title, body, outPath);
  }
}

main();
