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
import type { IngestOptions, IngestResult, RunArtifact } from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CASES_PATH = join(ROOT, "evals/cases.jsonl");
const GOLDEN_DIR = join(ROOT, "evals/golden");
const EXPECTED_DIR = join(ROOT, "evals/expected");
const FEEDBACK_LOG = join(ROOT, "data/runs/feedback.jsonl");
const RUNS_DIR = join(ROOT, "data/runs");

export function getRoot(): string {
  return ROOT;
}

export function loadRun(runId: string): RunArtifact {
  const path = join(RUNS_DIR, `${runId}.json`);
  if (!existsSync(path)) {
    throw new Error(`Run not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function inferExpectedFromSpec(
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

const FIELD_TYPE_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: "email", pattern: /\bemail(?:\s+address)?\b/i },
  { type: "file_upload", pattern: /\bfile\s+upload\b|\bupload\b.*\b(document|file|screenshot)\b/i },
  { type: "dropdown", pattern: /\bdropdown\b|\bselect\b|\boptions?\s*\(/i },
  { type: "radio", pattern: /\bradio\b|\b(yes\/no|yes or no)\b/i },
  { type: "checkbox", pattern: /\bcheckbox\b|\bcheck\s+box\b|\bagree\b/i },
  { type: "number", pattern: /\bnumber\s+field\b|\bnumber\s+of\b|\bamount\b|\byears?\s+of\s+experience\b/i },
  { type: "long_text", pattern: /\blong\s+text\b|\bmessage\b|\bdescription\b|\breason\b|\bcomments?\b/i },
  { type: "short_text", pattern: /\bshort\s+text\b|\bname\b|\bsubject\b|\baddress\b|\bcity\b|\bzip\b|\bdate\b/i },
  { type: "metadata", pattern: /\bmetadata\b/i },
];

function titleCase(label: string): string {
  return label
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function extractFieldLabels(prompt: string): string[] {
  const labels = new Set<string>();

  const withPattern =
    /\b(?:with|include|add|ask for|gather|collect)\s+([a-z][a-z0-9\s,/()-]{2,80}?)(?:\.|,|;|$|\band\b|\bthat\b|\bwhen\b|\bif\b)/gi;
  let match: RegExpExecArray | null;
  while ((match = withPattern.exec(prompt)) !== null) {
    const chunk = match[1];
    for (const part of chunk.split(/,|\band\b/)) {
      const cleaned = part
        .replace(/\bas\s+(?:a\s+)?(?:short\s+text|long\s+text|email|number|dropdown|radio|checkbox|file\s+upload)\b/gi, "")
        .replace(/\([^)]*\)/g, "")
        .trim();
      if (cleaned.length >= 3 && cleaned.length <= 60) {
        labels.add(titleCase(cleaned));
      }
    }
  }

  const explicitFields =
    /\b(full name|employee name|guest name|referrer name|candidate name|email address|email|message|subject|description|department|start date|end date|priority|rating)\b/gi;
  while ((match = explicitFields.exec(prompt)) !== null) {
    labels.add(titleCase(match[1]));
  }

  return [...labels];
}

export function inferExpectedFromPrompt(
  prompt: string,
  suggestedFixes: string[] = []
): Record<string, unknown> {
  const lower = prompt.toLowerCase();
  const fieldLabels = extractFieldLabels(prompt);
  const fieldTypes = FIELD_TYPE_PATTERNS.filter(({ pattern }) =>
    pattern.test(prompt)
  ).map(({ type }) => type);

  const expected: Record<string, unknown> = {
    min_fields: Math.max(2, fieldLabels.length || 2),
  };

  const allRequired =
    /\ball\s+(?:fields?\s+)?(?:should\s+be\s+|are\s+|must\s+be\s+)?required\b/i.test(
      prompt
    ) || /\bevery\s+field\s+(?:is\s+)?required\b/i.test(prompt);

  const optionalMentioned = /\boptional\b/i.test(prompt);

  if (fieldLabels.length) {
    if (allRequired && !optionalMentioned) {
      expected.required_fields = fieldLabels;
    } else {
      const requiredLabels = fieldLabels.filter(
        (l) => !new RegExp(`optional\\s+${l}`, "i").test(prompt)
      );
      if (requiredLabels.length) {
        expected.required_fields = requiredLabels;
      }
    }
  }

  if (
    /\bif\b|\bwhen\b|\bconditional\b|\bshow\b|\bhide\b|\benabl|\bdisabl/.test(
      lower
    )
  ) {
    expected.must_have_logic = true;
  }

  if (
    /\btheme\s+color\b|\bbrand(?:ing)?\b|\blogo\b|#[0-9a-f]{3,8}\b/i.test(
      prompt
    )
  ) {
    expected.must_have_branding = true;
  }

  if (fieldTypes.length) {
    expected.field_types = [...new Set(fieldTypes)];
  }

  if (suggestedFixes.length) {
    expected.human_notes = suggestedFixes;
  }

  return expected;
}

function caseExists(caseId: string): boolean {
  if (!existsSync(CASES_PATH)) return false;
  for (const line of readFileSync(CASES_PATH, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const c = JSON.parse(line);
      if (c.id === caseId) return true;
    } catch {
      /* skip malformed */
    }
  }
  return false;
}

export function validateSpec(path: string): boolean {
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

export function ingestFeedback(options: IngestOptions): IngestResult {
  const {
    runId,
    correctedSpec = null,
    promoteGolden = false,
    newCaseId = null,
    expectedFrom = "spec",
    humanRating,
    humanComment,
    category,
    skipRunUpdate = false,
  } = options;

  const run = loadRun(runId);

  mkdirSync(GOLDEN_DIR, { recursive: true });
  mkdirSync(EXPECTED_DIR, { recursive: true });
  mkdirSync(join(RUNS_DIR), { recursive: true });

  const specPath =
    correctedSpec ||
    (run.form_spec_path
      ? join(ROOT, run.form_spec_path)
      : join(RUNS_DIR, `${runId}.spec.json`));

  const caseId =
    newCaseId ||
    run.eval_case_id ||
    (humanRating !== undefined
      ? `human-rating-${runId}`
      : `feedback-${slugify(run.source_prompt || runId)}`);

  if (caseExists(caseId)) {
    return {
      caseId,
      expectedPath: join(EXPECTED_DIR, `${caseId}.json`),
      alreadyExists: true,
    };
  }

  let spec: Record<string, unknown> | null = null;
  if (existsSync(specPath)) {
    if (!validateSpec(specPath)) {
      throw new Error(`Spec validation failed: ${specPath}`);
    }
    spec = JSON.parse(readFileSync(specPath, "utf-8"));
  } else if (expectedFrom === "spec" && promoteGolden) {
    throw new Error(`FormSpec not found: ${specPath}`);
  }

  const suggestedFixes =
    run.scored?.suggested_fixes ?? run.suggested_fixes ?? [];

  const expected =
    expectedFrom === "prompt"
      ? inferExpectedFromPrompt(run.source_prompt || "", suggestedFixes)
      : inferExpectedFromSpec(spec ?? {});

  const evalCase: Record<string, unknown> = {
    id: caseId,
    category: category ?? (humanRating !== undefined ? "from_human_rating" : "from_feedback"),
    prompt: run.source_prompt || `Feedback case from run ${runId}`,
    expected,
    source_run_id: runId,
    ingested_at: new Date().toISOString(),
  };

  if (humanRating !== undefined) evalCase.human_rating = humanRating;
  if (humanComment) evalCase.human_comment = humanComment;

  appendFileSync(CASES_PATH, JSON.stringify(evalCase) + "\n");
  const expectedPath = join(EXPECTED_DIR, `${caseId}.json`);
  writeFileSync(expectedPath, JSON.stringify(expected, null, 2) + "\n");

  let goldenPath: string | undefined;
  if (promoteGolden && spec) {
    goldenPath = join(GOLDEN_DIR, `${caseId}.json`);
    writeFileSync(goldenPath, JSON.stringify(spec, null, 2) + "\n");
  }

  const feedbackEntry: Record<string, unknown> = {
    run_id: runId,
    new_case_id: caseId,
    corrected_spec: specPath ? basename(specPath) : null,
    promote_golden: promoteGolden,
    expected_from: expectedFrom,
    original_feedback: run.scored?.feedback ?? run.feedback ?? [],
    original_fixes: suggestedFixes,
    ingested_at: new Date().toISOString(),
  };
  if (humanRating !== undefined) feedbackEntry.human_rating = humanRating;
  if (humanComment) feedbackEntry.human_comment = humanComment;

  appendFileSync(FEEDBACK_LOG, JSON.stringify(feedbackEntry) + "\n");

  if (!skipRunUpdate) {
    run.scored = {
      ...run.scored,
      ingested: true,
      ingested_case_id: caseId,
    };
    writeFileSync(
      join(RUNS_DIR, `${runId}.json`),
      JSON.stringify(run, null, 2) + "\n"
    );
  }

  return { caseId, expectedPath, goldenPath, alreadyExists: false };
}
