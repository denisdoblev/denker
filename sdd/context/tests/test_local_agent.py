from __future__ import annotations

import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from sdd.context.local_agent import (
    Candidate,
    _frontier_connections,
    _test_subject,
    analyze,
    enumerate_files,
    merge_line_ranges,
    structural_class,
)


def model_envelope(payload, _timeout):
    if "BEGIN_EXCERPT" not in payload.get("prompt", ""):
        return {"response": json.dumps({"terms": ["SyncState"], "paths": ["src/sync.py", "missing.py"]})}
    match = re.search(r'EXCERPT_ID: (E\d+)\nPATH_JSON: "([^"]+)"', payload["prompt"])
    assert match
    excerpt_id = match.group(1)
    result = {
        "symbols": [],
        "evidence": [
            {
                "category": "facts",
                "statement": "The selected source contains synchronization behavior.",
                "classification": "observed",
                "citations": [{"excerpt_id": excerpt_id}],
            }
        ],
        "unknowns": [],
        "omitted": [],
    }
    return {
        "response": json.dumps(result),
        "prompt_eval_count": 20,
        "eval_count": 8,
        "total_duration": 100,
        "prompt_eval_duration": 40,
        "eval_duration": 50,
    }


class LocalAgentTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.repo = Path(self.temporary.name)
        (self.repo / "src").mkdir()
        (self.repo / "tests").mkdir()
        (self.repo / "docs").mkdir()
        (self.repo / "src" / "sync.py").write_text(
            "class SyncState:\n    pass\n\ndef complete_demo_sync():\n    return SyncState\n",
            encoding="utf-8",
        )
        (self.repo / "tests" / "test_sync.py").write_text(
            "from src.sync import SyncState\n\ndef test_sync():\n    assert SyncState\n",
            encoding="utf-8",
        )
        (self.repo / "docs" / "product.md").write_text("SyncState is governed here.\n", encoding="utf-8")
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)
        subprocess.run(["git", "add", "."], cwd=self.repo, check=True)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_analyze_discovers_reads_and_keeps_authority_direct(self) -> None:
        result = analyze(
            self.repo,
            "Trace SyncState and docs/product.md across synchronization tests",
            transport=model_envelope,
        )
        self.assertEqual("ok", result["status"])
        self.assertEqual("3", result["schema_version"])
        self.assertEqual("ok", result["technical_status"])
        self.assertEqual("sufficient", result["coverage"]["status"])
        self.assertIn("src/sync.py", [item["path"] for item in result["relevant_files"]])
        self.assertNotIn("docs/product.md", [item["path"] for item in result["sources"]])
        self.assertIn("docs/product.md", [item["path"] for item in result["recommended_reads"]])
        self.assertEqual(64, len(result["sources"][0]["sha256"]))
        self.assertGreater(result["metrics"]["source_tokens"], 0)
        self.assertGreater(result["metrics"]["packet_bytes"], 0)
        self.assertTrue(all("prompt" not in item for item in result["search_trace"]))

    def test_sparse_search_uses_bounded_local_expansion_and_verifies_suggestions(self) -> None:
        result = analyze(self.repo, "Investigate the mystery behavior", transport=model_envelope)
        self.assertEqual("ok", result["status"])
        expansion = next(item for item in result["search_trace"] if item["stage"] == "local-expansion")
        self.assertEqual(["src/sync.py"], expansion["accepted_paths"])
        self.assertLessEqual(len(expansion["accepted_terms"]), 8)
        self.assertNotIn("missing.py", [item["path"] for item in result["relevant_files"]])

    def test_full_file_and_long_file_ranges_follow_contract(self) -> None:
        self.assertEqual([{"start_line": 1, "end_line": 400}], merge_line_ranges([200], 400))
        self.assertEqual(
            [{"start_line": 1, "end_line": 90}, {"start_line": 420, "end_line": 580}],
            merge_line_ranges([10, 500], 700),
        )

    def test_enumeration_rejects_sensitive_binary_and_symlink_paths(self) -> None:
        (self.repo / ".env").write_text("TOKEN=x\n", encoding="utf-8")
        (self.repo / "src" / "binary.py").write_bytes(b"x\0y")
        outside = self.repo.parent / "outside-local-agent.py"
        outside.write_text("secret = 1\n", encoding="utf-8")
        link = self.repo / "src" / "escape.py"
        try:
            link.symlink_to(outside)
        except OSError:
            link = None
        subprocess.run(["git", "add", "-f", ".env", "src/binary.py"], cwd=self.repo, check=True)
        if link is not None:
            subprocess.run(["git", "add", "src/escape.py"], cwd=self.repo, check=True)
        files, _ = enumerate_files(self.repo)
        self.assertNotIn(".env", files)
        self.assertNotIn("src/escape.py", files)
        self.assertNotIn("src/binary.py", files)
        result = analyze(self.repo, "binary.py", transport=model_envelope)
        self.assertNotIn("src/binary.py", [item["path"] for item in result["sources"]])
        outside.unlink(missing_ok=True)

    def test_source_budget_caps_large_implementation_before_secondary_files(self) -> None:
        (self.repo / "src" / "huge.py").write_text("value = 1\n" * 500, encoding="utf-8")
        (self.repo / "src" / "tiny.py").write_text("TinyAnchor\n", encoding="utf-8")
        subprocess.run(["git", "add", "."], cwd=self.repo, check=True)
        with mock.patch("sdd.context.local_agent.SOURCE_SELECTION_TOKENS", 100):
            result = analyze(self.repo, "Trace src/huge.py and TinyAnchor", transport=model_envelope)
        selected = [item["path"] for item in result["relevant_files"]]
        self.assertIn("src/huge.py", selected)
        self.assertIn("src/tiny.py", selected)
        self.assertLessEqual(result["metrics"]["source_tokens"], 100)

    def test_structural_classes_prioritize_productive_source(self) -> None:
        self.assertEqual("implementation/source", structural_class("src/worker.ts"))
        self.assertEqual("tests", structural_class("src/worker.test.ts"))
        self.assertEqual("docs", structural_class("docs/worker.md"))
        self.assertEqual("config/schema", structural_class("schemas/worker.json"))

    def test_completion_requires_a_structural_connection_to_the_frontier(self) -> None:
        connected = Candidate("tests/test_worker.py", signals={"related-test:src/worker.py", "term:worker"})
        lexical_only = Candidate("docs/worker.txt", signals={"term:worker"})
        self.assertEqual(
            ["related-test:src/worker.py"],
            _frontier_connections(connected, {"src/worker.py"}),
        )
        self.assertEqual([], _frontier_connections(lexical_only, {"src/worker.py"}))

    def test_related_test_matching_uses_the_exact_source_stem(self) -> None:
        self.assertEqual("workspace", _test_subject("src/workspace.test.ts"))
        self.assertEqual("workspace", _test_subject("tests/test_workspace.py"))
        self.assertNotEqual("workspace", _test_subject("src/workspace-persistence.test.ts"))

    def test_changed_hash_forces_fallback(self) -> None:
        changed = False

        def changing_transport(payload, timeout):
            nonlocal changed
            response = model_envelope(payload, timeout)
            if "BEGIN_EXCERPT" in payload.get("prompt", "") and not changed:
                with (self.repo / "src" / "sync.py").open("a", encoding="utf-8") as stream:
                    stream.write("# changed\n")
                changed = True
            return response

        result = analyze(self.repo, "Trace SyncState", transport=changing_transport)
        self.assertEqual("fallback_required", result["status"])
        self.assertIn("hash changed", result["fallback_reason"])


if __name__ == "__main__":
    unittest.main()
