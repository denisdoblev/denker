#!/usr/bin/env python3
"""Run the bounded local-assisted discovery benchmark and calculate experiment gates."""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import sys
from pathlib import Path
from typing import Any, Mapping, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sdd.context.local_agent import analyze


def _citations(packet: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    return [
        citation
        for field in ("facts", "inferences", "relationships")
        for item in packet.get(field, [])
        for citation in item.get("citations", [])
    ]


def _contract_violations(repo: Path, packet: Mapping[str, Any]) -> list[str]:
    violations: list[str] = []
    if packet.get("schema_version") != "3":
        violations.append("invalid schema version")
    if len(packet.get("sources", [])) > 12 or len(packet.get("relevant_files", [])) > 12:
        violations.append("more than twelve files")
    if int((packet.get("metrics") or {}).get("source_tokens", 0)) > 21_000:
        violations.append("source budget exceeded")
    line_counts: dict[str, int] = {}
    for source in packet.get("sources", []):
        try:
            content = (repo / source["path"]).read_bytes()
            line_counts[source["path"]] = len(content.decode("utf-8").splitlines())
            if hashlib.sha256(content).hexdigest() != source["sha256"]:
                violations.append("stale source hash")
        except (KeyError, OSError, UnicodeDecodeError, TypeError):
            violations.append("invalid source")
    for citation in _citations(packet):
        path, start, end = citation.get("path"), citation.get("start_line"), citation.get("end_line")
        if path not in line_counts or not isinstance(start, int) or not isinstance(end, int) or not 1 <= start <= end <= line_counts[path]:
            violations.append("invalid citation")
    return sorted(set(violations))


def evaluate_case(repo: Path, case: Mapping[str, Any], model: str) -> dict[str, Any]:
    packet = analyze(repo, case["question"], model=model)
    selected = {item["path"] for item in packet.get("relevant_files", [])}
    required = set(case["required_files"])
    valid = required | set(case.get("support_files", []))
    recall = len(selected & required) / len(required) if required else 1.0
    precision = len(selected & valid) / len(selected) if selected else 0.0
    return {
        "id": case["id"],
        "local_assisted": {
            "status": packet.get("status"),
            "technical_status": packet.get("technical_status"),
            "coverage": packet.get("coverage"),
            "fallback_reason": packet.get("fallback_reason"),
            "selected_files": sorted(selected),
            "required_recall": round(recall, 4),
            "precision": round(precision, 4),
            "irrelevant_files": sorted(selected - valid),
            "critical_omissions": sorted(required - selected),
            "contract_violations": _contract_violations(repo, packet),
            "metrics": packet.get("metrics", {}),
        },
    }


def summarize(results: Sequence[Mapping[str, Any]], paired: Sequence[Mapping[str, Any]] = ()) -> dict[str, Any]:
    if not results:
        raise ValueError("at least one discovery result is required")
    assisted = [item["local_assisted"] for item in results]
    recalls = [float(item["required_recall"]) for item in assisted]
    selected_total = sum(len(item["selected_files"]) for item in assisted)
    relevant_total = sum(len(item["selected_files"]) - len(item["irrelevant_files"]) for item in assisted)
    precision = relevant_total / selected_total if selected_total else 0.0
    fallback_rate = sum(item["status"] != "ok" for item in assisted) / len(assisted)
    violations = sum(len(item["contract_violations"]) for item in assisted)
    omissions = sum(len(item["critical_omissions"]) for item in assisted)

    quality_available = bool(paired)
    quality_deltas = [float(item["local_quality"] - item["direct_quality"]) for item in paired]
    input_reductions = [
        1 - (float(item["local_input_tokens"]) / float(item["direct_input_tokens"]))
        for item in paired
        if item.get("direct_input_tokens", 0) > 0
    ]
    nonnegative_savings = sum(
        int(item.get("local_input_tokens", 0)) <= int(item.get("direct_input_tokens", 0)) for item in paired
    )
    gates = {
        "required_recall_at_least_95_percent_each_case": all(value >= 0.95 for value in recalls),
        "aggregate_precision_at_least_90_percent": precision >= 0.90,
        "zero_invalid_citations": violations == 0,
        "zero_critical_omissions": omissions == 0,
        "quality_not_worse_than_five_points_each_case": quality_available and all(value >= -5 for value in quality_deltas),
        "repair_correct_in_both_modes": quality_available and all(bool(item.get("correct")) for item in paired if item.get("kind") == "repair"),
        "fallback_at_most_25_percent": fallback_rate <= 0.25,
        "median_cloud_input_reduction_at_least_40_percent": bool(input_reductions) and statistics.median(input_reductions) >= 0.40,
        "nonnegative_savings_in_three_of_four_cases": len(paired) >= 4 and nonnegative_savings >= 3,
    }
    discovery_quality_gates = list(gates)[:4]
    paired_quality_gates = list(gates)[4:6]
    utility_gates = list(gates)[6:]
    if not all(gates[name] for name in discovery_quality_gates):
        verdict = "rejected"
    elif not quality_available:
        verdict = "inconclusive"
    elif not all(gates[name] for name in paired_quality_gates):
        verdict = "rejected"
    elif not all(gates[name] for name in utility_gates):
        verdict = "safe but not useful"
    else:
        verdict = "promising"
    return {
        "discovery_case_count": len(results),
        "paired_case_count": len(paired),
        "minimum_required_recall": round(min(recalls), 4),
        "aggregate_precision": round(precision, 4),
        "fallback_rate": round(fallback_rate, 4),
        "contract_violation_count": violations,
        "critical_omission_count": omissions,
        "median_cloud_input_reduction": round(statistics.median(input_reductions), 4) if input_reductions else None,
        "nonnegative_savings_cases": nonnegative_savings,
        "gates": gates,
        "verdict": verdict,
        "automatic_default_promotion": False,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=PROJECT_ROOT)
    parser.add_argument("--cases", type=Path, default=Path(__file__).with_name("cases.json"))
    parser.add_argument("--model", default="qwen3:8b")
    parser.add_argument("--paired-results", type=Path)
    parser.add_argument("--output", type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    repo = args.repo.resolve()
    cases = json.loads(args.cases.read_text(encoding="utf-8"))["cases"]
    results = [evaluate_case(repo, case, args.model) for case in cases]
    paired = json.loads(args.paired_results.read_text(encoding="utf-8"))["cases"] if args.paired_results else []
    report = {
        "schema_version": "3",
        "model": args.model,
        "decision_model": "gpt-5.6-sol",
        "cases": results,
        "paired": paired,
        "summary": summarize(results, paired),
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
