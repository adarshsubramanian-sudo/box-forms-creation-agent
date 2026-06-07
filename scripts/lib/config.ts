export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const HUMAN_RATING_LOW_THRESHOLD = envNumber("HUMAN_RATING_LOW_THRESHOLD", 6);
export const HUMAN_RATING_HIGH_THRESHOLD = envNumber("HUMAN_RATING_HIGH_THRESHOLD", 9);
export const GRADER_HUMAN_DELTA_THRESHOLD = envNumber(
  "GRADER_HUMAN_DELTA_THRESHOLD",
  0.25
);
