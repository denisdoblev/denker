from __future__ import annotations

import contextlib
import hashlib
import io
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from unittest import mock
from pathlib import Path

from sdd.runner.sdd_cycle import (
    MODEL,
    CommandResult,
    ConfigurationError,
    CycleRunner,
    Executor,
    OperationalStop,
    TaskArtifact,
    atomic_write_text,
    parse_codex_jsonl,
    validate_semantics,
)


def implement(result: str = "PASS", decision: str | None = None) -> dict[str, object]:
    return {
        "result": result,
        "files_modified": ["work.txt"] if result == "PASS" else [],
        "evidence": ["focused implementation evidence"],
        "decision_required": decision,
    }


def finding(message: str = "material issue") -> dict[str, str]:
    return {
        "axis": "SPEC",
        "severity": "medium",
        "location": "work.txt:1",
        "evidence": message,
        "contract": "AC-001",
        "impact": "required behavior is incomplete",
        "recommendation": "make the focused correction",
    }


def review(verdict: str = "PASS", *, message: str = "material issue", decision: str | None = None) -> dict[str, object]:
    actions = {"PASS": "NONE", "FAIL": "AUTO_FIX", "BLOCKED": "HUMAN_DECISION"}
    return {
        "verdict": verdict,
        "action": actions[verdict],
        "findings": [finding(message)] if verdict == "FAIL" else [],
        "decision_required": decision,
    }


def validation(
    verdict: str = "PASS",
    *,
    scope: str = "TASK",
    delta: str = "acceptance check failed",
    decision: str | None = None,
) -> dict[str, object]:
    actions = {"PASS": "NONE", "FAIL": "AUTO_FIX", "BLOCKED": "HUMAN_DECISION"}
    return {
        "scope": scope,
        "verdict": verdict,
        "action": actions[verdict],
        "checks": [
            {
                "name": "acceptance",
                "status": "PASS" if verdict == "PASS" else "FAIL" if verdict == "FAIL" else "NOT_VERIFIED",
                "evidence": "fresh evidence",
            }
        ],
        "evidence": ["command evidence"],
        "remaining_delta": [delta] if verdict == "FAIL" else [],
        "decision_required": decision,
    }


class FakeExecutor(Executor):
    def __init__(
        self,
        responses: list[tuple[str, object]],
        *,
        mutate_repairs: bool = True,
        mcp_servers: list[str] | None = None,
        jsonl_stdout: str | None = None,
    ):
        self.responses = list(responses)
        self.mutate_repairs = mutate_repairs
        self.mcp_servers = mcp_servers or ["serena"]
        self.jsonl_stdout = jsonl_stdout
        self.calls: list[tuple[list[str], str | None]] = []
        self.change_number = 0

    def run(self, argv, cwd, stdin=None):  # type: ignore[override]
        argv = list(argv)
        self.calls.append((argv, stdin))
        if argv[0] == "git":
            completed = subprocess.run(
                argv,
                cwd=cwd,
                text=True,
                encoding="utf-8",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            return CommandResult(completed.returncode, completed.stdout, completed.stderr)
        if argv == ["codex", "--version"]:
            return CommandResult(0, "codex-cli 0.160.0\n", "")
        if argv == ["codex", "debug", "models"]:
            catalog = {
                "models": [
                    {
                        "slug": MODEL,
                        "supported_reasoning_levels": [{"effort": "medium"}, {"effort": "xhigh"}],
                    }
                ]
            }
            return CommandResult(0, json.dumps(catalog), "")
        if argv == ["codex", "mcp", "list", "--json"]:
            return CommandResult(
                0,
                json.dumps([{"name": name, "enabled": True} for name in self.mcp_servers]),
                "",
            )
        if not self.responses:
            raise AssertionError("unexpected Codex execution")
        assert stdin is not None
        phase = next(line.split(": ", 1)[1] for line in stdin.splitlines() if line.startswith("SDD_RUNNER_PHASE:"))
        expected_phase, response = self.responses.pop(0)
        self.assert_phase(expected_phase, phase)
        if response == "interrupt":
            raise KeyboardInterrupt
        if isinstance(response, CommandResult):
            return response
        output = Path(argv[argv.index("--output-last-message") + 1])
        if response == "invalid-json":
            output.write_text("{", encoding="utf-8")
            return CommandResult(0, "", "invalid structured response")
        if response == "tamper-artifact":
            tasks_path = cwd / "specs" / "feature" / "tasks.md"
            tasks_path.write_text(
                tasks_path.read_text(encoding="utf-8").replace("**Status:** in_progress", "**Status:** completed"),
                encoding="utf-8",
            )
            response = implement()
        if response == "mutate-validation":
            self._mutate(cwd, "validate")
            response = validation()
        assert isinstance(response, dict)
        if phase == "IMPLEMENT" and response.get("result") == "PASS":
            self._mutate(cwd, "implement")
        if phase == "REPAIR" and response.get("result") == "PASS" and self.mutate_repairs:
            self._mutate(cwd, "repair")
        output.write_text(json.dumps(response), encoding="utf-8")
        events = [
            {"type": "thread.started", "thread_id": "test-thread"},
            {
                "type": "turn.completed",
                "usage": {
                    "input_tokens": 100,
                    "cached_input_tokens": 40,
                    "output_tokens": 20,
                    "reasoning_output_tokens": 5,
                },
            },
        ]
        stdout = self.jsonl_stdout if self.jsonl_stdout is not None else "\n".join(
            json.dumps(event) for event in events
        )
        return CommandResult(0, stdout, "bounded diagnostics")

    @staticmethod
    def assert_phase(expected: str, actual: str) -> None:
        if expected != actual:
            raise AssertionError(f"expected {expected}, got {actual}")

    def _mutate(self, cwd: Path, label: str) -> None:
        self.change_number += 1
        with (cwd / "work.txt").open("a", encoding="utf-8") as handle:
            handle.write(f"{label}-{self.change_number}\n")


class RunnerTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name)
        self.repo = self.base / "repo"
        self.repo.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)
        subprocess.run(["git", "config", "user.email", "runner@example.test"], cwd=self.repo, check=True)
        subprocess.run(["git", "config", "user.name", "Runner Test"], cwd=self.repo, check=True)
        (self.repo / "specs" / "feature").mkdir(parents=True)
        (self.repo / "specs" / "feature" / "spec.md").write_text("# Spec\n\nAC-001\n", encoding="utf-8")
        (self.repo / "specs" / "feature" / "plan.md").write_text("# Plan\n", encoding="utf-8")
        (self.repo / "work.txt").write_text("baseline\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def write_tasks(self, rows: list[tuple[str, str, str, str]]) -> Path:
        sections = []
        for task_id, status, dependencies, blocker in rows:
            sections.append(
                textwrap.dedent(
                    f"""
                    ## {task_id} — Outcome {task_id}

                    **Status:** {status}
                    **Depends on:** {dependencies}
                    **External blocker:** {blocker}
                    **Requirements:** AC-001

                    **Expected outcome:**
                    Outcome for {task_id}.

                    **Validation:**
                    Focused evidence.
                    """
                ).strip()
            )
        path = self.repo / "specs" / "feature" / "tasks.md"
        path.write_text(
            "# Feature — tasks\n\n**Spec:** specs/feature/spec.md\n**Plan:** specs/feature/plan.md\n\n"
            + "\n\n".join(sections)
            + "\n",
            encoding="utf-8",
        )
        return path

    def commit(self) -> None:
        subprocess.run(["git", "add", "."], cwd=self.repo, check=True)
        subprocess.run(["git", "commit", "-qm", "fixture"], cwd=self.repo, check=True)

    def runner(
        self,
        executor: Executor,
        *,
        task_id: str | None = None,
        max_repairs: int = 3,
        dry_run: bool = False,
        context_mode: str = "direct",
    ) -> CycleRunner:
        return CycleRunner(
            repo_root=self.repo,
            tasks_path=self.repo / "specs" / "feature" / "tasks.md",
            task_id=task_id,
            max_repairs=max_repairs,
            runs_dir=self.base / "runs",
            dry_run=dry_run,
            context_mode=context_mode,
            executor=executor,
        )

    def test_jsonl_parser_extracts_usage_without_retaining_event_payloads(self) -> None:
        stdout = "\n".join(
            [
                json.dumps({"type": "thread.started", "thread_id": "secret-thread"}),
                json.dumps(
                    {
                        "type": "turn.completed",
                        "usage": {
                            "input_tokens": 120,
                            "cached_input_tokens": 70,
                            "output_tokens": 30,
                            "reasoning_output_tokens": 9,
                        },
                    }
                ),
            ]
        )
        metrics = parse_codex_jsonl(stdout)
        self.assertEqual("complete", metrics["status"])
        self.assertEqual(120, metrics["usage"]["input_tokens"])
        self.assertEqual(1, metrics["other_event_count"])
        self.assertNotIn("secret-thread", json.dumps(metrics))

    def test_jsonl_parser_tolerates_incomplete_unknown_and_malformed_events(self) -> None:
        stdout = "\n".join(
            [
                "not-json",
                json.dumps({"unexpected": True}),
                json.dumps(
                    {
                        "type": "turn.completed",
                        "usage": {"input_tokens": 10, "cached_input_tokens": 4, "output_tokens": 2},
                    }
                ),
            ]
        )
        metrics = parse_codex_jsonl(stdout)
        self.assertEqual("partial", metrics["status"])
        self.assertEqual(1, metrics["malformed_event_count"])
        self.assertEqual(1, metrics["unknown_event_count"])
        self.assertEqual(["reasoning_output_tokens"], metrics["missing_usage_fields"])

    def test_cycle_aggregates_direct_mode_usage_and_duration(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor([("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", validation())])
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(0, runner.run())
        telemetry = runner.summary["telemetry"]
        self.assertEqual("direct", telemetry["context_mode"])
        self.assertEqual(3, telemetry["execution_count"])
        self.assertEqual(3, telemetry["executions_with_usage"])
        self.assertEqual(300, telemetry["token_usage"]["input_tokens"])
        self.assertEqual(100, telemetry["by_phase"]["IMPLEMENT"]["token_usage"]["input_tokens"])
        self.assertGreaterEqual(telemetry["duration_seconds"], 0)
        self.assertTrue(all("--json" in item["argv"] for item in runner.summary["executions"]))

    def test_cycle_continues_when_jsonl_usage_is_unavailable(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor(
            [("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", validation())],
            jsonl_stdout='{"future.event": true}\nnot-json',
        )
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(0, runner.run())
        telemetry = runner.summary["telemetry"]
        self.assertEqual(0, telemetry["executions_with_usage"])
        self.assertEqual(3, telemetry["executions_without_usage"])

    def test_local_assisted_mode_is_opt_in_implement_only_and_preserves_decision_model(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor([("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", validation())])
        runner = self.runner(fake, task_id="T1", context_mode="local-assisted")
        packet = {
            "schema_version": "3",
            "status": "ok",
            "technical_status": "ok",
            "coverage": {"status": "sufficient", "reasons": [], "omitted_high_signal": []},
            "task": "task",
            "summary": "summary",
            "sources": [],
            "relevant_files": [],
            "facts": [],
            "inferences": [],
            "relationships": [],
            "uncertainties": [],
            "recommended_reads": [],
            "search_trace": [],
            "fallback_reason": None,
            "metrics": {"files_read": 2, "source_tokens": 321, "errors": []},
        }
        with mock.patch.object(runner, "_prepare_local_assisted_context", return_value=packet) as prepare:
            self.assertEqual(0, runner.run())
        prepare.assert_called_once()
        phase_prompts = {
            next(line.split(": ", 1)[1] for line in prompt.splitlines() if line.startswith("SDD_RUNNER_PHASE:")): prompt
            for argv, prompt in fake.calls
            if prompt and argv[:4] == ["codex", "--ask-for-approval", "never", "exec"]
        }
        self.assertIn("Auxiliary context packet", phase_prompts["IMPLEMENT"])
        self.assertNotIn("Auxiliary context packet", phase_prompts["REVIEW"])
        self.assertNotIn("Auxiliary context packet", phase_prompts["VALIDATE"])
        self.assertTrue(all(item["model"] == MODEL for item in runner.summary["executions"]))
        self.assertEqual(1, runner.summary["telemetry"]["local_assisted_implementations"])
        self.assertEqual(2, runner.summary["telemetry"]["local_context"]["files_read"])
        self.assertEqual(321, runner.summary["telemetry"]["local_context"]["source_tokens"])

    def test_local_assisted_preprocessor_failure_falls_back_without_stopping_runner(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor([("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", validation())])
        runner = self.runner(fake, task_id="T1", context_mode="local-assisted")
        fallback = {
            "schema_version": "3",
            "status": "fallback_required",
            "technical_status": "fallback_required",
            "coverage": {"status": "unknown", "reasons": ["Ollama unavailable"], "omitted_high_signal": []},
            "fallback_reason": "Ollama unavailable",
            "metrics": {"errors": ["Ollama unavailable"]},
        }
        with mock.patch.object(runner, "_prepare_local_assisted_context", return_value=fallback):
            self.assertEqual(0, runner.run())
        self.assertEqual(1, runner.summary["telemetry"]["direct_fallbacks"])
        implement_prompt = next(
            prompt for argv, prompt in fake.calls if prompt and "SDD_RUNNER_PHASE: IMPLEMENT" in prompt
        )
        self.assertNotIn("Auxiliary context packet", implement_prompt)

    def test_local_assisted_technical_ok_with_partial_coverage_is_not_injected(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor([("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", validation())])
        runner = self.runner(fake, task_id="T1", context_mode="local-assisted")
        packet = {
            "schema_version": "3",
            "status": "ok",
            "technical_status": "ok",
            "coverage": {
                "status": "partial",
                "reasons": ["high-signal candidate omitted"],
                "omitted_high_signal": ["src/worker.ts"],
            },
            "metrics": {"errors": []},
        }
        with mock.patch.object(runner, "_prepare_local_assisted_context", return_value=packet):
            self.assertEqual(0, runner.run())
        self.assertEqual(1, runner.summary["telemetry"]["direct_fallbacks"])
        implement_prompt = next(
            prompt for argv, prompt in fake.calls if prompt and "SDD_RUNNER_PHASE: IMPLEMENT" in prompt
        )
        self.assertNotIn("Auxiliary context packet", implement_prompt)

    def test_local_assisted_subprocess_accepts_only_ok_current_hash_contract(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        runner = self.runner(FakeExecutor([]), task_id="T1", context_mode="local-assisted")
        packet = {
            "schema_version": "3",
            "status": "ok",
            "technical_status": "ok",
            "coverage": {"status": "sufficient", "reasons": [], "omitted_high_signal": []},
            "task": "task",
            "summary": "summary",
            "sources": [{"path": "work.txt", "sha256": "0" * 64}],
            "relevant_files": [],
            "facts": [],
            "inferences": [],
            "relationships": [],
            "uncertainties": [],
            "recommended_reads": [],
            "search_trace": [],
            "metrics": {"errors": []},
            "fallback_reason": None,
        }
        completed = subprocess.CompletedProcess([], 0, stdout=json.dumps(packet), stderr="")
        with mock.patch("sdd.runner.sdd_cycle.subprocess.run", return_value=completed) as run:
            result = runner._prepare_local_assisted_context(runner.artifact.tasks[0])
        self.assertEqual("fallback_required", result["status"])
        self.assertIn("hash changed", result["fallback_reason"])
        argv = run.call_args.args[0]
        self.assertIn("sdd/context/local_agent.py", argv[1])
        self.assertIn("analyze", argv)

    def test_local_assisted_subprocess_non_ok_is_not_injected(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        runner = self.runner(FakeExecutor([]), task_id="T1", context_mode="local-assisted")
        packet = {
            "schema_version": "3", "status": "partial", "technical_status": "ok",
            "coverage": {"status": "partial", "reasons": ["coverage gap"], "omitted_high_signal": []},
            "metrics": {"errors": []},
        }
        completed = subprocess.CompletedProcess([], 1, stdout=json.dumps(packet), stderr="bounded error")
        with mock.patch("sdd.runner.sdd_cycle.subprocess.run", return_value=completed):
            result = runner._prepare_local_assisted_context(runner.artifact.tasks[0])
        self.assertEqual("partial", result["status"])

    def test_local_assisted_subprocess_rejects_invalid_citation_contract(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        runner = self.runner(FakeExecutor([]), task_id="T1", context_mode="local-assisted")
        digest = hashlib.sha256((self.repo / "work.txt").read_bytes()).hexdigest()
        packet = {
            "schema_version": "3", "status": "ok", "technical_status": "ok",
            "coverage": {"status": "sufficient", "reasons": [], "omitted_high_signal": []},
            "task": "task", "summary": "summary",
            "sources": [{"path": "work.txt", "sha256": digest}], "relevant_files": [],
            "facts": [{
                "statement": "invented", "classification": "observed",
                "citations": [{"path": "work.txt", "start_line": 2, "end_line": 2}],
            }],
            "inferences": [], "relationships": [], "uncertainties": [], "recommended_reads": [],
            "search_trace": [], "metrics": {"errors": []}, "fallback_reason": None,
        }
        completed = subprocess.CompletedProcess([], 0, stdout=json.dumps(packet), stderr="")
        with mock.patch("sdd.runner.sdd_cycle.subprocess.run", return_value=completed):
            result = runner._prepare_local_assisted_context(runner.artifact.tasks[0])
        self.assertEqual("fallback_required", result["status"])
        self.assertIn("citation is invalid", result["fallback_reason"])

    def test_parser_rejects_missing_external_blocker_before_mutation(self) -> None:
        path = self.write_tasks([("T1", "ready", "none", "none")])
        original = path.read_text(encoding="utf-8").replace("**External blocker:** none\n", "")
        path.write_text(original, encoding="utf-8")
        with self.assertRaisesRegex(ConfigurationError, "external Blocker|External Blocker|external blocker"):
            TaskArtifact.load(path)
        self.assertEqual(original, path.read_text(encoding="utf-8"))

    def test_dependencies_and_dry_run_follow_document_order_without_side_effects(self) -> None:
        path = self.write_tasks(
            [("T1", "ready", "none", "none"), ("T2", "blocked", "T1", "none"), ("T3", "blocked", "T2", "none")]
        )
        self.commit()
        original = path.read_text(encoding="utf-8")
        fake = FakeExecutor([])
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = self.runner(fake, dry_run=True).run()
        self.assertEqual(0, code)
        self.assertEqual(["T1", "T2", "T3"], json.loads(output.getvalue())["tasks"])
        self.assertEqual([], fake.calls)
        self.assertEqual(original, path.read_text(encoding="utf-8"))
        self.assertFalse((self.base / "runs").exists())

    def test_full_cycle_transitions_three_tasks_and_closes_feature(self) -> None:
        path = self.write_tasks(
            [("T1", "ready", "none", "none"), ("T2", "blocked", "T1", "none"), ("T3", "blocked", "T2", "none")]
        )
        self.commit()
        responses: list[tuple[str, object]] = []
        for _ in range(3):
            responses.extend([("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", validation())])
        responses.append(("VALIDATE", validation(scope="FEATURE")))
        fake = FakeExecutor(responses)
        runner = self.runner(fake)
        self.assertEqual(0, runner.run())
        self.assertTrue(all(task.status == "completed" for task in TaskArtifact.load(path).tasks))
        self.assertEqual("cycle_complete", runner.summary["final_state"])
        self.assertEqual(0, runner.summary["model_policy"]["astra_executions"])
        self.assertEqual(0, runner.summary["model_policy"]["other_model_executions"])

    def test_task_option_runs_only_requested_task_without_global_validation(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none"), ("T2", "blocked", "T1", "none")])
        self.commit()
        fake = FakeExecutor([("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", validation())])
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(0, runner.run())
        artifact = TaskArtifact.load(self.repo / "specs" / "feature" / "tasks.md")
        self.assertEqual("completed", artifact.by_id["T1"].status)
        self.assertEqual("ready", artifact.by_id["T2"].status)
        phases = [item["phase"] for item in runner.summary["executions"]]
        self.assertEqual(["IMPLEMENT", "REVIEW", "VALIDATE"], phases)

    def test_review_failure_repairs_then_reviews_again(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor(
            [
                ("IMPLEMENT", implement()),
                ("REVIEW", review("FAIL")),
                ("REPAIR", implement()),
                ("REVIEW", review()),
                ("VALIDATE", validation()),
            ]
        )
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(0, runner.run())
        self.assertEqual(1, runner.summary["repair_count"])

    def test_validation_failure_repairs_reviews_and_revalidates(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor(
            [
                ("IMPLEMENT", implement()),
                ("REVIEW", review()),
                ("VALIDATE", validation("FAIL")),
                ("REPAIR", implement()),
                ("REVIEW", review()),
                ("VALIDATE", validation()),
            ]
        )
        self.assertEqual(0, self.runner(fake, task_id="T1").run())

    def test_human_decision_stops_and_leaves_task_in_progress(self) -> None:
        path = self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor(
            [("IMPLEMENT", implement()), ("REVIEW", review("BLOCKED", decision="choose compatibility behavior"))]
        )
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(1, runner.run())
        self.assertIn("human decision", runner.summary["stop_reason"])
        self.assertIn("**Status:** in_progress", path.read_text(encoding="utf-8"))

    def test_repair_limit_stops_before_repair(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor([("IMPLEMENT", implement()), ("REVIEW", review("FAIL"))])
        runner = self.runner(fake, task_id="T1", max_repairs=0)
        self.assertEqual(1, runner.run())
        self.assertIn("repair limit 0", runner.summary["stop_reason"])

    def test_repair_without_repository_change_stops(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor(
            [("IMPLEMENT", implement()), ("REVIEW", review("FAIL")), ("REPAIR", implement())],
            mutate_repairs=False,
        )
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(1, runner.run())
        self.assertIn("made no repository progress", runner.summary["stop_reason"])

    def test_audit_directory_inside_repo_does_not_count_as_repair_progress(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor(
            [("IMPLEMENT", implement()), ("REVIEW", review("FAIL")), ("REPAIR", implement())],
            mutate_repairs=False,
        )
        runner = CycleRunner(
            repo_root=self.repo,
            tasks_path=self.repo / "specs" / "feature" / "tasks.md",
            task_id="T1",
            max_repairs=3,
            runs_dir=self.repo / "audit",
            dry_run=False,
            executor=fake,
        )
        self.assertEqual(1, runner.run())
        self.assertIn("made no repository progress", runner.summary["stop_reason"])

    def test_unauthorized_artifact_mutation_is_restored_and_stops(self) -> None:
        path = self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        runner = self.runner(FakeExecutor([("IMPLEMENT", "tamper-artifact")]), task_id="T1")
        self.assertEqual(1, runner.run())
        self.assertIn("unauthorized artifact changes", runner.summary["stop_reason"])
        self.assertIn("**Status:** in_progress", path.read_text(encoding="utf-8"))

    def test_repeated_review_and_validation_feedback_stop(self) -> None:
        for kind in ("review", "validation"):
            with self.subTest(kind=kind):
                self.tearDown()
                self.setUp()
                self.write_tasks([("T1", "ready", "none", "none")])
                self.commit()
                if kind == "review":
                    responses = [
                        ("IMPLEMENT", implement()),
                        ("REVIEW", review("FAIL", message="same")),
                        ("REPAIR", implement()),
                        ("REVIEW", review("FAIL", message="same")),
                    ]
                else:
                    responses = [
                        ("IMPLEMENT", implement()),
                        ("REVIEW", review()),
                        ("VALIDATE", validation("FAIL", delta="same")),
                        ("REPAIR", implement()),
                        ("REVIEW", review()),
                        ("VALIDATE", validation("FAIL", delta="same")),
                    ]
                runner = self.runner(FakeExecutor(responses), task_id="T1")
                self.assertEqual(1, runner.run())
                self.assertIn("repeated the same", runner.summary["stop_reason"])

    def test_interruption_child_failure_and_invalid_output_are_audited(self) -> None:
        cases = {
            "interrupt": ("interrupt", "interrupted"),
            "child": (CommandResult(9, "", "boom"), "exited 9"),
            "json": ("invalid-json", "invalid structured output"),
        }
        for name, (response, expected) in cases.items():
            with self.subTest(name=name):
                self.tearDown()
                self.setUp()
                path = self.write_tasks([("T1", "ready", "none", "none")])
                self.commit()
                runner = self.runner(FakeExecutor([("IMPLEMENT", response)]), task_id="T1")
                self.assertEqual(1, runner.run())
                self.assertIn(expected, runner.summary["stop_reason"])
                self.assertIn("**Status:** in_progress", path.read_text(encoding="utf-8"))
                self.assertTrue((runner.run_dir / "summary.json").is_file())  # type: ignore[operator]

    def test_feature_validation_failure_does_not_reopen_task(self) -> None:
        path = self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor(
            [
                ("IMPLEMENT", implement()),
                ("REVIEW", review()),
                ("VALIDATE", validation()),
                ("VALIDATE", validation("FAIL", scope="FEATURE", delta="feature gap")),
            ]
        )
        runner = self.runner(fake)
        self.assertEqual(1, runner.run())
        self.assertEqual("completed", TaskArtifact.load(path).by_id["T1"].status)
        self.assertEqual(0, runner.summary["repair_count"])

    def test_external_blocker_and_unknown_task_are_handled(self) -> None:
        self.write_tasks([("T1", "blocked", "none", "waiting for vendor")])
        self.commit()
        runner = self.runner(FakeExecutor([]))
        self.assertEqual(1, runner.run())
        self.assertIn("external blocker", runner.summary["stop_reason"])
        with self.assertRaisesRegex(ConfigurationError, "unknown task ID"):
            self.runner(FakeExecutor([]), task_id="T9")

    def test_model_effort_sandbox_and_capability_policy(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        runner = self.runner(FakeExecutor([]), dry_run=True)
        runner.mcp_servers = ["serena"]
        for phase in ("IMPLEMENT", "REPAIR", "REVIEW", "VALIDATE"):
            argv = runner._build_argv(phase, Path("schema.json"), Path("answer.json"))
            runner._assert_execution_policy(phase, argv)
            effort = "xhigh" if phase == "REVIEW" else "medium"
            self.assertIn(f'model_reasoning_effort="{effort}"', argv)
            self.assertEqual("read-only" if phase == "REVIEW" else "workspace-write", argv[argv.index("--sandbox") + 1])
            self.assertIn("sandbox_workspace_write.network_access=false", argv)
            self.assertIn("mcp_servers={}", argv)
        forbidden = runner._build_argv("REVIEW", Path("schema.json"), Path("answer.json"))
        forbidden[forbidden.index(MODEL)] = "gpt-6-astra"
        with self.assertRaisesRegex(OperationalStop, "fixed model policy"):
            runner._assert_execution_policy("REVIEW", forbidden)
        network_enabled = runner._build_argv("IMPLEMENT", Path("schema.json"), Path("answer.json"))
        network_enabled[network_enabled.index("sandbox_workspace_write.network_access=false")] = (
            "sandbox_workspace_write.network_access=true"
        )
        with self.assertRaisesRegex(OperationalStop, "network access"):
            runner._assert_execution_policy("IMPLEMENT", network_enabled)
        mcp_enabled = runner._build_argv("IMPLEMENT", Path("schema.json"), Path("answer.json"))
        mcp_enabled[mcp_enabled.index("mcp_servers={}")] = 'mcp_servers."serena".enabled=true'
        with self.assertRaisesRegex(OperationalStop, "empty table"):
            runner._assert_execution_policy("IMPLEMENT", mcp_enabled)

    def test_preflight_disables_and_audits_every_effective_mcp(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor(
            [("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", validation())],
            mcp_servers=["serena", "user.docs"],
        )
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(0, runner.run())
        phase_calls = [argv for argv, _ in fake.calls if argv[:4] == ["codex", "--ask-for-approval", "never", "exec"]]
        self.assertTrue(phase_calls)
        self.assertTrue(all("mcp_servers={}" in argv for argv in phase_calls))
        self.assertTrue(all(not any(item.startswith("mcp_servers.") for item in argv) for argv in phase_calls))
        self.assertEqual(["serena", "user.docs"], runner.summary["effective_mcp_servers_disabled"])

    def test_validate_pass_requires_checks_passing_evidence_and_no_delta(self) -> None:
        invalid_results = []
        no_checks = validation()
        no_checks["checks"] = []
        invalid_results.append((no_checks, "at least one check"))
        failed_check = validation()
        failed_check["checks"][0]["status"] = "FAIL"  # type: ignore[index]
        invalid_results.append((failed_check, "every check"))
        no_evidence = validation()
        no_evidence["evidence"] = []
        invalid_results.append((no_evidence, "include evidence"))
        remaining = validation()
        remaining["remaining_delta"] = ["still missing"]
        invalid_results.append((remaining, "no remaining_delta"))
        for result, message in invalid_results:
            with self.subTest(message=message), self.assertRaisesRegex(OperationalStop, message):
                validate_semantics("VALIDATE", result)

    def test_review_uses_actual_implementation_delta_not_reported_paths(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        misreported = implement()
        misreported["files_modified"] = ["claimed.txt"]
        fake = FakeExecutor([("IMPLEMENT", misreported), ("REVIEW", review()), ("VALIDATE", validation())])
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(0, runner.run())
        review_prompt = next(
            prompt for argv, prompt in fake.calls if prompt and "SDD_RUNNER_PHASE: REVIEW" in prompt
        )
        self.assertIn('Modified paths: ["work.txt"]', review_prompt)
        execution = runner.summary["executions"][0]
        self.assertEqual(["claimed.txt"], execution["reported_files_modified"])
        self.assertEqual(["work.txt"], execution["actual_files_modified"])
        self.assertFalse(execution["files_modified_match"])

    def test_validate_repository_mutation_stops_cycle(self) -> None:
        path = self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        fake = FakeExecutor([("IMPLEMENT", implement()), ("REVIEW", review()), ("VALIDATE", "mutate-validation")])
        runner = self.runner(fake, task_id="T1")
        self.assertEqual(1, runner.run())
        self.assertIn("VALIDATE changed tracked or non-ignored files: work.txt", runner.summary["stop_reason"])
        self.assertIn("**Status:** in_progress", path.read_text(encoding="utf-8"))

    def test_atomic_write_preserves_existing_permissions(self) -> None:
        path = self.base / "permissions.txt"
        path.write_text("before\n", encoding="utf-8")
        path.chmod(0o640)
        atomic_write_text(path, "after\n")
        self.assertEqual(0o640, stat.S_IMODE(path.stat().st_mode))

    def test_runs_dir_rejects_overlap_with_tracked_content(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        with self.assertRaisesRegex(ConfigurationError, "overlaps tracked"):
            CycleRunner(
                repo_root=self.repo,
                tasks_path=self.repo / "specs" / "feature" / "tasks.md",
                task_id="T1",
                max_repairs=3,
                runs_dir=self.repo / "specs",
                dry_run=False,
                executor=FakeExecutor([]),
            )

    def test_repository_snapshot_excludes_only_current_audit_directory(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        audit = self.repo / "audit"
        current = audit / "current"
        current.mkdir(parents=True)
        preexisting = audit / "preexisting.txt"
        preexisting.write_text("before\n", encoding="utf-8")
        runner = CycleRunner(
            repo_root=self.repo,
            tasks_path=self.repo / "specs" / "feature" / "tasks.md",
            task_id="T1",
            max_repairs=3,
            runs_dir=audit,
            dry_run=False,
            executor=FakeExecutor([]),
        )
        runner.run_dir = current
        before = runner._repository_snapshot()
        preexisting.write_text("after\n", encoding="utf-8")
        (current / "summary.json").write_text("{}\n", encoding="utf-8")
        changed = runner._changed_paths(before, runner._repository_snapshot())
        self.assertEqual(["audit/preexisting.txt"], changed)

    def test_semantically_invalid_output_stops(self) -> None:
        self.write_tasks([("T1", "ready", "none", "none")])
        self.commit()
        invalid_review = review()
        invalid_review["action"] = "AUTO_FIX"
        runner = self.runner(FakeExecutor([("IMPLEMENT", implement()), ("REVIEW", invalid_review)]), task_id="T1")
        self.assertEqual(1, runner.run())
        self.assertIn("invalid verdict/action combination", runner.summary["stop_reason"])


class FakeCodexSmokeTest(unittest.TestCase):
    def test_cli_smoke_uses_fresh_processes_and_bounded_repair(self) -> None:
        project_root = Path(__file__).resolve().parents[3]
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            repo = base / "repo"
            repo.mkdir()
            shutil.copytree(project_root / "sdd" / "runner", repo / "sdd" / "runner")
            shutil.copytree(project_root / ".agents" / "skills", repo / ".agents" / "skills")
            feature = repo / "specs" / "smoke"
            feature.mkdir(parents=True)
            (feature / "spec.md").write_text("# Smoke spec\n\nAC-001\n", encoding="utf-8")
            (feature / "plan.md").write_text("# Smoke plan\n", encoding="utf-8")
            rows = [
                ("T1", "ready", "none"),
                ("T2", "blocked", "T1"),
                ("T3", "blocked", "T2"),
            ]
            sections = []
            for task_id, status, dependency in rows:
                sections.append(
                    f"## {task_id} — Smoke {task_id}\n\n"
                    f"**Status:** {status}\n**Depends on:** {dependency}\n**External blocker:** none\n"
                    "**Requirements:** AC-001\n\n**Expected outcome:**\nSmoke output.\n\n"
                    "**Validation:**\nFresh local evidence.\n"
                )
            tasks = feature / "tasks.md"
            tasks.write_text(
                "# Smoke — tasks\n\n**Spec:** specs/smoke/spec.md\n**Plan:** specs/smoke/plan.md\n\n"
                + "\n".join(sections),
                encoding="utf-8",
            )
            (repo / "work.txt").write_text("baseline\n", encoding="utf-8")
            subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "smoke@example.test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Smoke"], cwd=repo, check=True)
            subprocess.run(["git", "add", "."], cwd=repo, check=True)
            subprocess.run(["git", "commit", "-qm", "smoke fixture"], cwd=repo, check=True)

            bin_dir = base / "bin"
            bin_dir.mkdir()
            state_path = base / "state.json"
            fake = bin_dir / "codex"
            fake.write_text(
                textwrap.dedent(
                    """\
                    #!/usr/bin/env python3
                    import json
                    import os
                    from pathlib import Path
                    import sys

                    args = sys.argv[1:]
                    state_path = Path(os.environ["FAKE_CODEX_STATE"])
                    state = json.loads(state_path.read_text()) if state_path.exists() else {"reviews": 0, "pids": []}
                    if args == ["--version"]:
                        print("codex-cli 0.160.0")
                        raise SystemExit(0)
                    if args == ["debug", "models"]:
                        print(json.dumps({"models": [{"slug": "gpt-5.6-sol", "supported_reasoning_levels": [{"effort": "medium"}, {"effort": "xhigh"}]}]}))
                        raise SystemExit(0)
                    if args == ["mcp", "list", "--json"]:
                        print("[]")
                        raise SystemExit(0)
                    prompt = sys.stdin.read()
                    phase = next(line.split(": ", 1)[1] for line in prompt.splitlines() if line.startswith("SDD_RUNNER_PHASE:"))
                    state["pids"].append(os.getpid())
                    schema = Path(args[args.index("--output-schema") + 1])
                    output = Path(args[args.index("--output-last-message") + 1])
                    if not schema.is_file() or "$sdd-" not in prompt:
                        raise SystemExit(7)
                    if phase in {"IMPLEMENT", "REPAIR"}:
                        with Path("work.txt").open("a") as handle:
                            handle.write(phase.lower() + "\\n")
                        result = {"result": "PASS", "files_modified": ["work.txt"], "evidence": ["fake smoke"], "decision_required": None}
                    elif phase == "REVIEW":
                        state["reviews"] += 1
                        if state["reviews"] == 1:
                            result = {"verdict": "FAIL", "action": "AUTO_FIX", "findings": [{"axis": "SPEC", "severity": "medium", "location": "work.txt:1", "evidence": "forced smoke finding", "contract": "AC-001", "impact": "smoke repair path", "recommendation": "repair once"}], "decision_required": None}
                        else:
                            result = {"verdict": "PASS", "action": "NONE", "findings": [], "decision_required": None}
                    else:
                        scope = "FEATURE" if "Validation scope: FEATURE" in prompt else "TASK"
                        result = {"scope": scope, "verdict": "PASS", "action": "NONE", "checks": [{"name": "smoke", "status": "PASS", "evidence": "fake process"}], "evidence": ["fake smoke"], "remaining_delta": [], "decision_required": None}
                    output.write_text(json.dumps(result))
                    state_path.write_text(json.dumps(state))
                    print(json.dumps({"type": "turn.completed", "usage": {"input_tokens": 100, "cached_input_tokens": 40, "output_tokens": 20, "reasoning_output_tokens": 5}}))
                    """
                ),
                encoding="utf-8",
            )
            fake.chmod(0o755)
            environment = os.environ.copy()
            environment["PATH"] = str(bin_dir) + os.pathsep + environment["PATH"]
            environment["FAKE_CODEX_STATE"] = str(state_path)
            completed = subprocess.run(
                [sys.executable, "sdd/runner/sdd_cycle.py", "--tasks", "specs/smoke/tasks.md"],
                cwd=repo,
                env=environment,
                text=True,
                encoding="utf-8",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            self.assertEqual(0, completed.returncode, completed.stderr)
            self.assertTrue(all(task.status == "completed" for task in TaskArtifact.load(tasks).tasks))
            state = json.loads(state_path.read_text(encoding="utf-8"))
            self.assertEqual(len(state["pids"]), len(set(state["pids"])))
            self.assertGreaterEqual(state["reviews"], 4)


if __name__ == "__main__":
    unittest.main()
