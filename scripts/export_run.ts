/**
 * Export an anonymized run artifact for sharing via GitHub Issue or PR.
 *
 * Usage:
 *   npm run export-run -- --run-id <id> [--output path]
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeExport } from "./lib/export.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
    console.error("Batch:    npm run export-runs -- --run-ids id1,id2  OR  --since 2026-06-07");
    process.exit(1);
  }
  return { runId, output: get("--output") };
}

function main(): void {
  const { runId, output } = parseArgs();
  try {
    const outPath = writeExport(ROOT, runId, output || undefined);
    console.log(`Exported anonymized run: ${outPath}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Review the export for any sensitive content");
    console.log("  2. npm run create-eval-issue -- --run-ids " + runId);
    console.log("     (drafts a GitHub Issue; add --create to submit with gh CLI)");
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
