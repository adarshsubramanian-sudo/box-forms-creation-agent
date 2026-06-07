export interface HumanFeedback {
  rating: number;
  comment?: string;
  collected_at: string;
  grader_overall?: number;
  grader_human_delta?: number;
  disagreement_flag?: boolean;
  auto_ingested?: boolean;
  auto_ingested_case_id?: string;
}

export interface RunArtifact {
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
    ingested?: boolean;
    ingested_case_id?: string;
  };
  feedback?: string[];
  suggested_fixes?: string[];
  human_feedback?: HumanFeedback;
}

export interface IngestOptions {
  runId: string;
  correctedSpec?: string | null;
  promoteGolden?: boolean;
  newCaseId?: string | null;
  expectedFrom?: "spec" | "prompt";
  humanRating?: number;
  humanComment?: string;
  category?: string;
  skipRunUpdate?: boolean;
}

export interface IngestResult {
  caseId: string;
  expectedPath: string;
  goldenPath?: string;
  alreadyExists: boolean;
}
