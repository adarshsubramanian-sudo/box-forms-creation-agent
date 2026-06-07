/**
 * Summarize human ratings and grader-human correlation.
 *
 * Usage:
 *   npx tsx scripts/summarize_ratings.ts [--output path]
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GRADER_HUMAN_DELTA_THRESHOLD } from "./lib/config.js";
import type { RunArtifact } from "./lib/types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS_DIR = join(ROOT, "data/runs");
const RATINGS_LOG = join(RUNS_DIR, "ratings.jsonl");

interface RatingSummary {
  generated_at: string;
  total_ratings: number;
  average_rating: number | null;
  buckets: {
    low_1_3: number;
    mid_4_6: number;
    good_7_8: number;
    excellent_9_10: number;
  };
  grader_human: {
    rated_with_grader_score: number;
    mean_delta: number | null;
    disagreement_count: number;
    disagreement_threshold: number;
  };
  auto_ingested_count: number;
  ratings: Array<{
    run_id: string;
    rating: number;
    comment?: string;
    grader_overall?: number;
    grader_human_delta?: number;
    auto_ingested?: boolean;
  }>;
}

function parseArgs(): { output: string | null } {
  const args = process.argv.slice(2);
  const i = args.indexOf("--output");
  return { output: i >= 0 ? args[i + 1] : null };
}

function loadRatingsFromRuns(): RatingSummary["ratings"] {
  const ratings: RatingSummary["ratings"] = [];
  if (!existsSync(RUNS_DIR)) return ratings;

  for (const file of readdirSync(RUNS_DIR)) {
    if (!file.endsWith(".json") || file.startsWith("eval_report_")) continue;
    try {
      const run = JSON.parse(
        readFileSync(join(RUNS_DIR, file), "utf-8")
      ) as RunArtifact;
      if (!run.human_feedback?.rating) continue;
      ratings.push({
        run_id: run.run_id,
        rating: run.human_feedback.rating,
        comment: run.human_feedback.comment,
        grader_overall: run.human_feedback.grader_overall,
        grader_human_delta: run.human_feedback.grader_human_delta,
        auto_ingested: run.human_feedback.auto_ingested,
      });
    } catch {
      /* skip */
    }
  }
  return ratings;
}

function bucket(rating: number): keyof RatingSummary["buckets"] {
  if (rating <= 3) return "low_1_3";
  if (rating <= 6) return "mid_4_6";
  if (rating <= 8) return "good_7_8";
  return "excellent_9_10";
}

function main(): void {
  const { output } = parseArgs();
  const ratings = loadRatingsFromRuns();

  const buckets: RatingSummary["buckets"] = {
    low_1_3: 0,
    mid_4_6: 0,
    good_7_8: 0,
    excellent_9_10: 0,
  };

  let deltaSum = 0;
  let deltaCount = 0;
  let disagreementCount = 0;
  let autoIngested = 0;
  let ratingSum = 0;

  for (const r of ratings) {
    ratingSum += r.rating;
    buckets[bucket(r.rating)]++;
    if (r.grader_human_delta !== undefined) {
      deltaSum += r.grader_human_delta;
      deltaCount++;
      if (r.grader_human_delta > GRADER_HUMAN_DELTA_THRESHOLD) {
        disagreementCount++;
      }
    }
    if (r.auto_ingested) autoIngested++;
  }

  const summary: RatingSummary = {
    generated_at: new Date().toISOString(),
    total_ratings: ratings.length,
    average_rating:
      ratings.length > 0 ? ratingSum / ratings.length : null,
    buckets,
    grader_human: {
      rated_with_grader_score: deltaCount,
      mean_delta: deltaCount > 0 ? deltaSum / deltaCount : null,
      disagreement_count: disagreementCount,
      disagreement_threshold: GRADER_HUMAN_DELTA_THRESHOLD,
    },
    auto_ingested_count: autoIngested,
    ratings,
  };

  mkdirSync(RUNS_DIR, { recursive: true });
  const outPath =
    output || join(RUNS_DIR, "ratings_summary.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n");

  console.log("Human ratings summary");
  console.log("=====================");
  console.log(`Total ratings:     ${summary.total_ratings}`);
  console.log(
    `Average rating:    ${summary.average_rating?.toFixed(2) ?? "n/a"}`
  );
  console.log(`Auto-ingested:     ${summary.auto_ingested_count}`);
  console.log("");
  console.log("Buckets:");
  console.log(`  1–3 (low):       ${buckets.low_1_3}`);
  console.log(`  4–6 (mid):       ${buckets.mid_4_6}`);
  console.log(`  7–8 (good):      ${buckets.good_7_8}`);
  console.log(`  9–10 (excellent): ${buckets.excellent_9_10}`);
  console.log("");
  console.log("Grader vs human:");
  console.log(
    `  Mean delta:      ${summary.grader_human.mean_delta?.toFixed(4) ?? "n/a"}`
  );
  console.log(
    `  Disagreements:   ${disagreementCount} (threshold ${GRADER_HUMAN_DELTA_THRESHOLD})`
  );
  console.log("");
  console.log(`Written to: ${outPath}`);
  if (existsSync(RATINGS_LOG)) {
    console.log(`Event log:  ${RATINGS_LOG}`);
  }
}

main();
