#!/usr/bin/env python3
"""Validate a Box FormSpec JSON file against schema and business rules."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

FIELD_TYPES = {
    "short_text",
    "long_text",
    "checkbox",
    "radio",
    "dropdown",
    "number",
    "file_upload",
    "email",
    "metadata",
}
CHOICE_TYPES = {"checkbox", "radio", "dropdown"}
LOGIC_OPERATORS = {
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "is_empty",
    "is_not_empty",
    "greater_than",
    "less_than",
}
LOGIC_OUTCOMES = {"show", "hide", "enable", "disable"}
FIELD_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ValidationError(Exception):
    pass


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValidationError(f"Invalid JSON: {e}") from e
    if not isinstance(data, dict):
        raise ValidationError("FormSpec root must be a JSON object")
    return data


def validate_spec(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    def err(msg: str) -> None:
        errors.append(msg)

    title = data.get("title")
    if not title or not isinstance(title, str) or not title.strip():
        err("title is required and must be a non-empty string")
    elif len(title) > 255:
        err("title must be at most 255 characters")

    if "name" in data and data["name"] is not None:
        if not isinstance(data["name"], str):
            err("name must be a string")
        elif len(data["name"]) > 255:
            err("name must be at most 255 characters")

    if "description" in data and data["description"] is not None:
        if not isinstance(data["description"], str):
            err("description must be a string")
        elif len(data["description"]) > 2000:
            err("description must be at most 2000 characters")

    branding = data.get("branding")
    if branding is not None:
        if not isinstance(branding, dict):
            err("branding must be an object")
        else:
            if "theme_color" in branding:
                color = branding["theme_color"]
                if not isinstance(color, str) or not HEX_COLOR_PATTERN.match(color):
                    err("branding.theme_color must be a hex color like #0061D5")
            if "header_logo_url" in branding:
                url = branding["header_logo_url"]
                if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                    err("branding.header_logo_url must be an http(s) URL")

    fields = data.get("fields")
    if not isinstance(fields, list) or len(fields) == 0:
        err("fields is required and must be a non-empty array")
        fields = []

    field_ids: set[str] = set()
    for i, field in enumerate(fields):
        prefix = f"fields[{i}]"
        if not isinstance(field, dict):
            err(f"{prefix} must be an object")
            continue

        fid = field.get("id")
        if not fid or not isinstance(fid, str) or not FIELD_ID_PATTERN.match(fid):
            err(f"{prefix}.id must match ^[a-z][a-z0-9_]*$")
        elif fid in field_ids:
            err(f"{prefix}.id '{fid}' is duplicated")
        else:
            field_ids.add(fid)

        ftype = field.get("type")
        if ftype not in FIELD_TYPES:
            err(f"{prefix}.type must be one of: {sorted(FIELD_TYPES)}")

        label = field.get("label")
        if not label or not isinstance(label, str) or not label.strip():
            err(f"{prefix}.label is required")

        if "required" in field and not isinstance(field["required"], bool):
            err(f"{prefix}.required must be a boolean")

        if ftype in CHOICE_TYPES:
            options = field.get("options")
            if not isinstance(options, list) or len(options) == 0:
                err(f"{prefix}.options is required for type '{ftype}'")
            else:
                for j, opt in enumerate(options):
                    if not isinstance(opt, dict):
                        err(f"{prefix}.options[{j}] must be an object")
                        continue
                    if not opt.get("value") or not opt.get("label"):
                        err(f"{prefix}.options[{j}] requires value and label")

        if ftype == "metadata":
            if not field.get("metadata_template"):
                err(f"{prefix}.metadata_template is required for metadata fields")

        validation = field.get("validation")
        if validation is not None:
            if not isinstance(validation, dict):
                err(f"{prefix}.validation must be an object")

    logic = data.get("logic", [])
    if logic is None:
        logic = []
    if not isinstance(logic, list):
        err("logic must be an array")
        logic = []

    for i, rule in enumerate(logic):
        prefix = f"logic[{i}]"
        if not isinstance(rule, dict):
            err(f"{prefix} must be an object")
            continue

        match_mode = rule.get("match")
        if match_mode not in ("all", "any"):
            err(f"{prefix}.match must be 'all' or 'any'")

        outcome = rule.get("outcome")
        if outcome not in LOGIC_OUTCOMES:
            err(f"{prefix}.outcome must be one of: {sorted(LOGIC_OUTCOMES)}")

        conditions = rule.get("conditions")
        if not isinstance(conditions, list) or len(conditions) == 0:
            err(f"{prefix}.conditions must be a non-empty array")
        else:
            for j, cond in enumerate(conditions):
                cp = f"{prefix}.conditions[{j}]"
                if not isinstance(cond, dict):
                    err(f"{cp} must be an object")
                    continue
                ref_id = cond.get("field_id")
                if not ref_id or ref_id not in field_ids:
                    err(f"{cp}.field_id '{ref_id}' must reference an existing field id")
                op = cond.get("operator")
                if op not in LOGIC_OPERATORS:
                    err(f"{cp}.operator must be one of: {sorted(LOGIC_OPERATORS)}")
                if op not in ("is_empty", "is_not_empty") and "value" not in cond:
                    err(f"{cp}.value is required for operator '{op}'")

        targets = rule.get("target_field_ids")
        if not isinstance(targets, list) or len(targets) == 0:
            err(f"{prefix}.target_field_ids must be a non-empty array")
        else:
            for tid in targets:
                if tid not in field_ids:
                    err(f"{prefix}.target_field_ids contains unknown field id '{tid}'")

    return errors


def check_expected(spec: dict[str, Any], expected: dict[str, Any]) -> list[str]:
    """Compare spec against eval case expected criteria. Returns list of failures."""
    failures: list[str] = []
    fields = spec.get("fields", [])

    min_fields = expected.get("min_fields")
    if min_fields is not None and len(fields) < min_fields:
        failures.append(f"Expected at least {min_fields} fields, got {len(fields)}")

    max_fields = expected.get("max_fields")
    if max_fields is not None and len(fields) > max_fields:
        failures.append(f"Expected at most {max_fields} fields, got {len(fields)}")

    required_labels = expected.get("required_fields", [])
    spec_labels = {f.get("label", "").lower() for f in fields if isinstance(f, dict)}
    for label in required_labels:
        if label.lower() not in spec_labels:
            failures.append(f"Missing required field label: '{label}'")

    must_have_logic = expected.get("must_have_logic")
    logic = spec.get("logic") or []
    if must_have_logic and len(logic) == 0:
        failures.append("Expected conditional logic rules but none found")

    expected_types = expected.get("field_types")
    if expected_types:
        actual_types = [f.get("type") for f in fields if isinstance(f, dict)]
        for et in expected_types:
            if et == "date_or_text":
                if not any(t in ("short_text", "long_text") for t in actual_types):
                    failures.append("Expected a date or text field")
            elif et not in actual_types:
                failures.append(f"Expected field type '{et}' not found in spec")

    forbidden_types = expected.get("forbidden_field_types", [])
    actual_types = [f.get("type") for f in fields if isinstance(f, dict)]
    for ft in forbidden_types:
        if ft in actual_types:
            failures.append(f"Forbidden field type '{ft}' present in spec")

    if expected.get("must_have_branding"):
        branding = spec.get("branding") or {}
        if not branding.get("theme_color"):
            failures.append("Expected branding.theme_color")

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Box FormSpec JSON")
    parser.add_argument("spec_path", type=Path, help="Path to FormSpec JSON file")
    parser.add_argument(
        "--expected",
        type=Path,
        help="Optional eval expected criteria JSON for deterministic checks",
    )
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    try:
        spec = load_json(args.spec_path)
        schema_errors = validate_spec(spec)
        expected_failures: list[str] = []
        if args.expected:
            expected = load_json(args.expected)
            expected_failures = check_expected(spec, expected)

        all_errors = schema_errors + expected_failures
        ok = len(all_errors) == 0

        if args.json:
            print(
                json.dumps(
                    {
                        "valid": ok,
                        "schema_errors": schema_errors,
                        "expected_failures": expected_failures,
                        "field_count": len(spec.get("fields", [])),
                        "logic_count": len(spec.get("logic") or []),
                    },
                    indent=2,
                )
            )
        else:
            if ok:
                print(f"OK: {args.spec_path}")
            else:
                print(f"FAIL: {args.spec_path}", file=sys.stderr)
                for e in all_errors:
                    print(f"  - {e}", file=sys.stderr)

        return 0 if ok else 1
    except ValidationError as e:
        if args.json:
            print(json.dumps({"valid": False, "error": str(e)}))
        else:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
