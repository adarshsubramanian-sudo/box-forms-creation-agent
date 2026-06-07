/**
 * Batch-export anonymized run artifacts for sharing.
 *
 * Usage:
 *   npm run export-runs -- --run-ids id1,id2,id3
 *   npm run export-runs -- --since 2026-06-07
 *   npm run export-runs -- --since 20260607 --run-ids id1,id2   (union)
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listRunIds,
  normalizeSinceDate,
  writeExport,
} from "./lib/export.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(): { runIds: string[]; since: string | null } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };

  const runIdsArg = get("--run-ids");
  const since = get("--since");
  const runIds = runIdsArg
    ? runIdsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (runIds.length === 0 && !since) {
    console.error("Required: --run-ids <id1,id2,...> and/or --since <YYYY-MM-DD>");
    console.error("");
    console.error("Examples:");
    console.error("  npm run export-runs -- --run-ids 20260607-190104-contact,20260607-190626-vendor-intake");
    console.error("  npm run export-runs -- --since 2026-06-07");
    process.exit(1);
  }

  return { runIds, since };
}

function resolveRunIds(runIds: string[], since: string | null): string[] {
  const ids = new Set<string>(runIds);

  if (since) {
    const prefix = normalizeSinceDate(since);
    for (const id of listRunIds(ROOT, prefix)) {
      ids.add(id);
    }
  }

  return [...ids].sort();
}

function main(): void {
  const { runIds, since } = parseArgs();
  const targets = resolveRunIds(runIds, since);

  if (targets.length === 0) {
    console.error("No runs matched the given filters.");
    process.exit(1);
  }

  const exported: string[] = [];
  const failed: Array<{ runId: string; error: string }> = [];

  for (const runId of targets) {
    try {
      exported.push(writeExport(ROOT, runId));
    } catch (err) {
      failed.push({
        runId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(`Exported ${exported.length} run(s):`);
  for (const path of exported) {
    console.log(`  ${path}`);
  }

  if (failed.length > 0) {
    console.error("");
    console.error(`Failed ${failed.length} run(s):`);
    for (const f of failed) {
      console.error(`  ${f.runId}: ${f.error}`);
    }
  }

  if (exported.length > 0) {
    const idList = targets.filter((id) => !failed.some((f) => f.runId === id)).join(",");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Review exports for sensitive content");
    console.log(`  2. npm run create-eval-issue -- --run-ids ${idList}`);
    console.log("     (drafts a GitHub Issue; add --create to submit with gh CLI)");
  }

  if (failed.length > 0 && exported.length === 0) {
    process.exit(1);
  }
}

main();
