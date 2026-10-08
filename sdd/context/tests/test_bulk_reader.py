from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from sdd.context.bulk_reader import (
    MAX_BATCHES,
    SYSTEM_PROMPT,
    ContextContractError,
    Excerpt,
    Source,
    load_sources,
    make_batches,
    make_excerpts,
    model_schema_for_batch,
    run_bulk_reader,
)


def request(path: str = "src/a.py", end: int = 3) -> dict[str, object]:
    return {
        "schema_version": "2",
        "task_id": "T1",
        "question": "What functions and behavior are present?",
        "focus": "behavior",
        "files": [{"path": path, "ranges": [{"start_line": 1, "end_line": end}]}],
        "max_output_tokens": 600,
    }


def model_result(excerpt_id: str = "E1", statement: str = "run returns one") -> dict[str, object]:
    evidence = {
        "category": "facts",
        "statement": statement,
        "classification": "observed",
        "citations": [{"excerpt_id": excerpt_id}],
    }
    return {
        "symbols": [{"name": "run", "kind": "function", "excerpt_id": excerpt_id}],
        "evidence": [evidence],
        "unknowns": [],
        "omitted": [],
    }


def envelope(result: dict[str, object]) -> dict[str, object]:
    return {
        "response": json.dumps(result),
        "prompt_eval_count": 40,
        "prompt_eval_cached_count": 10,
        "eval_count": 20,
        "total_duration": 100,
        "load_duration": 10,
        "prompt_eval_duration": 40,
        "eval_duration": 50,
    }


class BulkReaderTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.repo = Path(self.temporary.name)
        (self.repo / "src").mkdir()
        (self.repo / "src" / "a.py").write_text("def run():\n    return 1\n# end\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_extracts_schema_bound_cited_facts_and_metrics(self) -> None:
        calls = []

        def fake(payload, timeout):
            calls.append((payload, timeout))
            return envelope(model_result())

        result = run_bulk_reader(self.repo, request(), transport=fake)
        self.assertEqual("ok", result["status"])
        self.assertEqual("src/a.py", result["sources"][0]["path"])
        self.assertEqual(64, len(result["sources"][0]["sha256"]))
        self.assertEqual(40, result["metrics"]["prompt_eval_count"])
        self.assertEqual(1, result["metrics"]["batch_count"])
        self.assertFalse(calls[0][0]["think"])
        self.assertEqual(0, calls[0][0]["options"]["temperature"])
        self.assertEqual(16384, calls[0][0]["options"]["num_ctx"])
        self.assertEqual(600, calls[0][0]["options"]["num_predict"])
        self.assertIn(json.dumps(calls[0][0]["format"], ensure_ascii=False, sort_keys=True), calls[0][0]["prompt"])
        citation_id = calls[0][0]["format"]["properties"]["evidence"]["items"]["properties"]["citations"]["items"]["properties"]["excerpt_id"]
        self.assertEqual(["E1"], citation_id["enum"])
        self.assertEqual(
            {"path": "src/a.py", "start_line": 1, "end_line": 3},
            result["facts"][0]["citations"][0],
        )
        self.assertEqual(400_000_000.0, result["metrics"]["tokens_per_second"])
        self.assertTrue(result["metrics"]["cache_hit"])
        self.assertEqual(0.25, result["metrics"]["cache_hit_rate"])
        self.assertEqual(1, len(result["metrics"]["batches"]))

    def test_rejects_absolute_escape_secret_binary_and_out_of_range(self) -> None:
        (self.repo / ".env").write_text("TOKEN=x\n", encoding="utf-8")
        (self.repo / "binary.bin").write_bytes(b"a\0b")
        outside = self.repo.parent / "outside-reader.txt"
        outside.write_text("secret\n", encoding="utf-8")
        link = self.repo / "src" / "escape.py"
        try:
            link.symlink_to(outside)
        except OSError:
            link = None
        cases = [
            request("/tmp/x", 1),
            request(".env", 1),
            request("binary.bin", 1),
            request("src/a.py", 99),
        ]
        if link is not None:
            cases.append(request("src/escape.py", 1))
        for value in cases:
            with self.subTest(value=value):
                result = run_bulk_reader(self.repo, value, transport=lambda *_: envelope(model_result()))
                self.assertEqual("fallback_required", result["status"])
        outside.unlink(missing_ok=True)

    def test_large_ranges_split_with_twenty_line_overlap(self) -> None:
        lines = tuple(f"line {index} " + "x" * 30 for index in range(1, 101))
        source = Source("big.txt", self.repo / "big.txt", lines, "0" * 64, ((1, 100),))
        excerpts = make_excerpts([source], token_limit=600)
        self.assertGreater(len(excerpts), 1)
        self.assertEqual(excerpts[0].end_line - 20 + 1, excerpts[1].start_line)

    def test_invalid_json_retries_once_then_succeeds(self) -> None:
        responses = [{"response": "{"}, envelope(model_result())]

        def fake(_payload, _timeout):
            return responses.pop(0)

        result = run_bulk_reader(self.repo, request(), transport=fake)
        self.assertEqual("ok", result["status"])
        self.assertEqual(1, result["metrics"]["retry_count"])

    def test_invented_excerpt_id_invalidates_whole_execution(self) -> None:
        invalid = model_result()
        invalid["evidence"][0]["citations"][0]["excerpt_id"] = "E99"  # type: ignore[index]
        result = run_bulk_reader(self.repo, request(), transport=lambda *_: envelope(invalid))
        self.assertEqual("fallback_required", result["status"])
        self.assertEqual([], result["facts"])
        self.assertIn("invented excerpt id", result["unknowns"][0])

    def test_contract_deduplicates_claims_across_batches(self) -> None:
        lines = "\n".join(f"value_{index} = '{'x' * 80}'" for index in range(1, 501)) + "\n"
        (self.repo / "src" / "large.py").write_text(lines, encoding="utf-8")
        req = request("src/large.py", 500)

        def fake(payload, _timeout):
            match = __import__("re").search(
                r'EXCERPT_ID: (E\d+)\nPATH_JSON: "src/large.py"\nAVAILABLE_LINES: (\d+)-(\d+)', payload["prompt"]
            )
            assert match
            result = model_result(match.group(1), "same claim")
            result["symbols"] = []
            return envelope(result)

        result = run_bulk_reader(self.repo, req, transport=fake)
        self.assertIn(result["status"], {"ok", "partial"})
        # Dedupe includes the citation range, so repeated claims from different source ranges remain distinct evidence.
        keys = {
            (item["statement"], item["citations"][0]["start_line"])
            for item in result["facts"]
        }
        self.assertEqual(len(result["facts"]), len(keys))

    def test_caps_three_batches_with_two_evidence_and_600_tokens_each(self) -> None:
        excerpts = [Excerpt(f"src/{index}.py", 1, 1, "x" * 20_000) for index in range(4)]
        batches, omitted = make_batches(excerpts, token_limit=1_000)
        self.assertEqual(MAX_BATCHES, len(batches))
        self.assertEqual(1, len(omitted))

        for index in range(3):
            path = self.repo / "src" / f"b{index}.py"
            path.write_text("x = 1\n" * 3000, encoding="utf-8")
        req = request("src/a.py", 3)
        req["files"] = [
            {"path": "src/b0.py", "ranges": [{"start_line": 1, "end_line": 3000}]},
            {"path": "src/b1.py", "ranges": [{"start_line": 1, "end_line": 3000}]},
            {"path": "src/b2.py", "ranges": [{"start_line": 1, "end_line": 3000}]},
        ]
        calls = []

        def fake(payload, _timeout):
            calls.append(payload)
            match = __import__("re").search(r'EXCERPT_ID: (E\d+)\nPATH_JSON: "([^"]+)"', payload["prompt"])
            assert match
            result = model_result(match.group(1))
            result["symbols"] = []
            return envelope(result)

        result = run_bulk_reader(self.repo, req, transport=fake)
        self.assertEqual(3, result["metrics"]["batch_count"])
        self.assertTrue(all(call["options"]["num_predict"] == 600 for call in calls))
        self.assertTrue(all(call["format"]["properties"]["evidence"]["maxItems"] == 2 for call in calls))

    def test_rejects_overlong_statements_and_normalizes_same_file_second_citation(self) -> None:
        overlong = model_result(statement="x" * 201)
        result = run_bulk_reader(self.repo, request(), transport=lambda *_: envelope(overlong))
        self.assertEqual("fallback_required", result["status"])

        duplicate = model_result()
        duplicate["evidence"][0]["citations"].append(  # type: ignore[index]
            {"excerpt_id": "E1"}
        )
        result = run_bulk_reader(self.repo, request(), transport=lambda *_: envelope(duplicate))
        self.assertEqual("ok", result["status"])
        self.assertEqual(1, len(result["facts"][0]["citations"]))

    def test_fixed_prompt_contains_every_forbidden_decision_class(self) -> None:
        for phrase in (
            "ambiguous requirements", "product scope", "architecture", "security/privacy",
            "concurrency/transactions/migrations/compatibility", "public contracts", "final cause",
            "select a fix", "write or edit code", "review correctness", "validation verdict",
        ):
            self.assertIn(phrase, SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()
