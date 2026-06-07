/**
 * Promote a failed run (and optional human correction) into the eval suite.
 *
 * Usage:
 *   npx tsx scripts/ingest_feedback.ts --run-id <id> [--corrected-spec path] [--promote-golden]
 *   npx tsx scripts/ingest_feedback.ts --run-id <id> --expected-from prompt [--human-rating 4] [--human-comment "..."]
 */

import { ingestFeedback } from "./lib/ingest.js";

function parseArgs(): {
  runId: string;
  correctedSpec: string | null;
  promoteGolden: boolean;
  newCaseId: string | null;
  expectedFrom: "spec" | "prompt";
  humanRating: number | undefined;
  humanComment: string | undefined;
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
  const expectedFromRaw = get("--expected-from");
  const humanRatingRaw = get("--human-rating");
  return {
    runId,
    correctedSpec: get("--corrected-spec"),
    promoteGolden: args.includes("--promote-golden"),
    newCaseId: get("--new-case-id"),
    expectedFrom: expectedFromRaw === "prompt" ? "prompt" : "spec",
    humanRating:
      humanRatingRaw !== null ? Number(humanRatingRaw) : undefined,
    humanComment: get("--human-comment") ?? undefined,
  };
}

function main(): void {
  const {
    runId,
    correctedSpec,
    promoteGolden,
    newCaseId,
    expectedFrom,
    humanRating,
    humanComment,
  } = parseArgs();

  if (
    humanRating !== undefined &&
    (!Number.isInteger(humanRating) || humanRating < 1 || humanRating > 10)
  ) {
    console.error("--human-rating must be an integer from 1 to 10");
    process.exit(1);
  }

  try {
    const result = ingestFeedback({
      runId,
      correctedSpec,
      promoteGolden,
      newCaseId,
      expectedFrom,
      humanRating,
      humanComment,
    });

    if (result.alreadyExists) {
      console.log(`Eval case already exists: ${result.caseId}`);
      process.exit(0);
    }

    console.log(`Ingested feedback from run ${runId}`);
    console.log(`New eval case: ${result.caseId}`);
    console.log(`Expected: ${result.expectedPath}`);
    if (result.goldenPath) {
      console.log(`Promoted golden spec: ${result.goldenPath}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
