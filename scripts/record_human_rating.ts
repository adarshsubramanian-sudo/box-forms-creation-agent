/**
 * Record a human 1–10 rating for a build run and trigger learning loop actions.
 *
 * Usage:
 *   npx tsx scripts/record_human_rating.ts --run-id <id> --rating <1-10> [--comment "..."] [--force]
 */

import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GRADER_HUMAN_DELTA_THRESHOLD,
  HUMAN_RATING_HIGH_THRESHOLD,
  HUMAN_RATING_LOW_THRESHOLD,
} from "./lib/config.js";
import { ingestFeedback, loadRun } from "./lib/ingest.js";
import type { HumanFeedback, RunArtifact } from "./lib/types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS_DIR = join(ROOT, "data/runs");
const RATINGS_LOG = join(RUNS_DIR, "ratings.jsonl");

function parseArgs(): {
  runId: string;
  rating: number;
  comment: string | null;
  force: boolean;
} {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const runId = get("--run-id");
  const ratingRaw = get("--rating");
  if (!runId || !ratingRaw) {
    console.error("Required: --run-id <run_id> --rating <1-10>");
    console.error(
      "Example: npm run record-rating -- --run-id 20260607-190104-contact --rating 8"
    );
    process.exit(1);
  }
  const rating = Number(ratingRaw);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    console.error("Rating must be an integer from 1 to 10");
    process.exit(1);
  }
  return {
    runId,
    rating,
    comment: get("--comment"),
    force: args.includes("--force"),
  };
}

function main(): void {
  const { runId, rating, comment, force } = parseArgs();
  const run = loadRun(runId);

  if (run.human_feedback && !force) {
    console.error(
      `Run ${runId} already has a rating (${run.human_feedback.rating}). Use --force to overwrite.`
    );
    process.exit(1);
  }

  const graderOverall = run.scored?.scores?.overall;
  const graderHumanDelta =
    graderOverall !== undefined
      ? Math.abs(rating / 10 - graderOverall)
      : undefined;
  const disagreementFlag =
    graderHumanDelta !== undefined &&
    graderHumanDelta > GRADER_HUMAN_DELTA_THRESHOLD;

  const humanFeedback: HumanFeedback = {
    rating,
    collected_at: new Date().toISOString(),
  };
  if (comment) humanFeedback.comment = comment;
  if (graderOverall !== undefined) humanFeedback.grader_overall = graderOverall;
  if (graderHumanDelta !== undefined) {
    humanFeedback.grader_human_delta = graderHumanDelta;
  }
  if (disagreementFlag) humanFeedback.disagreement_flag = true;

  let ingestAction: string | null = null;

  const scoredPass = run.scored?.pass === true;
  const lowRating = rating <= HUMAN_RATING_LOW_THRESHOLD;
  const highRating =
    rating >= HUMAN_RATING_HIGH_THRESHOLD && scoredPass;

  try {
    if (lowRating) {
      const result = ingestFeedback({
        runId,
        expectedFrom: "prompt",
        humanRating: rating,
        humanComment: comment ?? undefined,
        category: "from_human_rating",
        skipRunUpdate: true,
      });
      if (result.alreadyExists) {
        ingestAction = `eval case already exists: ${result.caseId}`;
        humanFeedback.auto_ingested = true;
        humanFeedback.auto_ingested_case_id = result.caseId;
      } else {
        ingestAction = `auto-ingested eval case (low rating): ${result.caseId}`;
        humanFeedback.auto_ingested = true;
        humanFeedback.auto_ingested_case_id = result.caseId;
      }
    } else if (highRating) {
      const result = ingestFeedback({
        runId,
        expectedFrom: "spec",
        promoteGolden: true,
        humanRating: rating,
        humanComment: comment ?? undefined,
        category: "from_human_rating",
        skipRunUpdate: true,
      });
      if (result.alreadyExists) {
        ingestAction = `eval case already exists: ${result.caseId}`;
        humanFeedback.auto_ingested = true;
        humanFeedback.auto_ingested_case_id = result.caseId;
      } else {
        ingestAction = `auto-ingested + golden promoted (high rating): ${result.caseId}`;
        humanFeedback.auto_ingested = true;
        humanFeedback.auto_ingested_case_id = result.caseId;
      }
    }
  } catch (err) {
    console.error("Auto-ingest failed:", err instanceof Error ? err.message : err);
  }

  const updatedRun: RunArtifact = {
    ...run,
    human_feedback: humanFeedback,
    scored: {
      ...run.scored,
      ingested: humanFeedback.auto_ingested ?? run.scored?.ingested,
      ingested_case_id:
        humanFeedback.auto_ingested_case_id ?? run.scored?.ingested_case_id,
    },
  };

  mkdirSync(RUNS_DIR, { recursive: true });
  writeFileSync(
    join(RUNS_DIR, `${runId}.json`),
    JSON.stringify(updatedRun, null, 2) + "\n"
  );

  const logEntry = {
    type: "human_rating",
    run_id: runId,
    rating,
    comment: comment ?? null,
    grader_overall: graderOverall ?? null,
    grader_human_delta: graderHumanDelta ?? null,
    disagreement_flag: disagreementFlag ?? false,
    auto_ingested: humanFeedback.auto_ingested ?? false,
    auto_ingested_case_id: humanFeedback.auto_ingested_case_id ?? null,
    at: humanFeedback.collected_at,
  };
  appendFileSync(RATINGS_LOG, JSON.stringify(logEntry) + "\n");

  console.log(`Recorded human rating ${rating}/10 for run ${runId}`);
  if (comment) console.log(`Comment: ${comment}`);
  if (graderOverall !== undefined) {
    console.log(
      `Grader overall: ${graderOverall.toFixed(4)} | delta: ${graderHumanDelta?.toFixed(4)}`
    );
  }
  if (disagreementFlag) {
    console.log(
      `Disagreement flag: human vs grader delta exceeds ${GRADER_HUMAN_DELTA_THRESHOLD}`
    );
  }
  if (ingestAction) console.log(ingestAction);
  console.log(`Ratings log: ${RATINGS_LOG}`);
}

main();
