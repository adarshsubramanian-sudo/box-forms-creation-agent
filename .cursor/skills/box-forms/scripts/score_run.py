#!/usr/bin/env python3
"""Aggregate grader scores for a Box Forms run artifact."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

DEFAULT_WEIGHTS = {
    "deterministic": 0.4,
    "rubric": 0.35,
    "visual": 0.25,
}
DEFAULT_PASS_THRESHOLD = 0.8


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def score_run(
    run: dict[str, Any],
    *,
    weights: dict[str, float] | None = None,
    pass_threshold: float = DEFAULT_PASS_THRESHOLD,
) -> dict[str, Any]:
    weights = weights or DEFAULT_WEIGHTS
    scores = run.get("scores") or {}

    det = clamp(float(scores.get("deterministic", 0.0)))
    rubric = clamp(float(scores.get("rubric", 0.0)))
    visual = clamp(float(scores.get("visual", 0.0)))

    # If visual was skipped (browser failure), redistribute weight to det + rubric
    visual_skipped = run.get("visual_skipped", False)
    w = dict(weights)
    if visual_skipped:
        redist = w["visual"]
        w["deterministic"] += redist * 0.6
        w["rubric"] += redist * 0.4
        w["visual"] = 0.0
        visual = 0.0

    overall = (
        det * w["deterministic"]
        + rubric * w["rubric"]
        + visual * w["visual"]
    )
    overall = round(clamp(overall), 4)

    pass_flag = overall >= pass_threshold
    if run.get("deterministic_failures"):
        pass_flag = False

    return {
        "run_id": run.get("run_id"),
        "scores": {
            "deterministic": det,
            "rubric": rubric,
            "visual": visual,
            "overall": overall,
        },
        "weights_used": w,
        "pass": pass_flag,
        "pass_threshold": pass_threshold,
        "feedback": run.get("feedback", []),
        "suggested_fixes": run.get("suggested_fixes", []),
        "deterministic_failures": run.get("deterministic_failures", []),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Score a Box Forms run artifact")
    parser.add_argument("run_path", type=Path, help="Path to run JSON in data/runs/")
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_PASS_THRESHOLD,
        help="Pass threshold for overall score",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write scored result back into run file under 'scored' key",
    )
    args = parser.parse_args()

    run = load_json(args.run_path)
    result = score_run(run, pass_threshold=args.threshold)

    if args.write:
        run["scored"] = result
        with args.run_path.open("w", encoding="utf-8") as f:
            json.dump(run, f, indent=2)
            f.write("\n")

    print(json.dumps(result, indent=2))
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
