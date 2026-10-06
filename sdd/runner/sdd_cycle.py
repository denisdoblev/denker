#!/usr/bin/env python3
"""Run the minimum bounded SDD implement/review/validate cycle."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


MODEL = "gpt-5.6-sol"
EFFORTS = {"REVIEW": "xhigh", "IMPLEMENT": "medium", "REPAIR": "medium", "VALIDATE": "medium"}
SANDBOXES = {"REVIEW": "read-only", "IMPLEMENT": "workspace-write", "REPAIR": "workspace-write", "VALIDATE": "workspace-write"}
DISABLED_FEATURES = (
    "apps",
    "browser_use",
    "browser_use_external",
    "browser_use_full_cdp_access",
    "computer_use",
    "goals",
    "hooks",
    "image_generation",
    "memories",
    "multi_agent",
    "multi_agent_v2",
    "plugins",
    "remote_plugin",
    "skill_mcp_dependency_install",
    "workspace_dependencies",
)
SCHEMA_FILES = {
    "IMPLEMENT": "implement_repair.schema.json",
    "REPAIR": "implement_repair.schema.json",
    "REVIEW": "review.schema.json",
    "VALIDATE": "validate.schema.json",
}
TASK_HEADER_RE = re.compile(r"^##\s+(T[A-Za-z0-9._-]+)\s+[—-]\s+(.+?)\s*$", re.MULTILINE)
FIELD_RE = re.compile(r"^\*\*(?P<name>[^*]+):\*\*\s*(?P<value>.*?)\s*$", re.MULTILINE)
VALID_STATUSES = {"ready", "blocked", "in_progress", "completed"}
LOG_LIMIT = 32_000
DIFF_LIMIT = 24_000


class ConfigurationError(Exception):
    """The CLI arguments or artifact contract are invalid."""


class OperationalStop(Exception):
    """The cycle must stop safely after execution has started."""


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: str
    stderr: str


class Executor:
    def run(self, argv: Sequence[str], cwd: Path, stdin: str | None = None) -> CommandResult:
        try:
            completed = subprocess.run(
                list(argv),
                cwd=cwd,
                input=stdin,
                text=True,
                encoding="utf-8",
                errors="replace",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
        except OSError as exc:
            raise OperationalStop(f"could not execute {argv[0]}: {exc}") from exc
        return CommandResult(completed.returncode, completed.stdout, completed.stderr)


@dataclass
class Task:
    task_id: str
    title: str
    status: str
    depends_on: tuple[str, ...]
    external_blocker: str
    body: str
    start: int
    end: int


class TaskArtifact:
    def __init__(self, path: Path, text: str):
        self.path = path
        self.text = text
        self.spec_path = self._document_path("Spec")
        self.plan_path = self._document_path("Plan")
        self.tasks = self._parse_tasks()
        self._validate_graph()

    @classmethod
    def load(cls, path: Path) -> "TaskArtifact":
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            raise ConfigurationError(f"cannot read tasks artifact {path}: {exc}") from exc
        return cls(path, text)

    def _document_path(self, name: str) -> str:
        matches = re.findall(rf"^\*\*{re.escape(name)}:\*\*\s*(.+?)\s*$", self.text, re.MULTILINE)
        if len(matches) != 1 or not matches[0].strip():
            raise ConfigurationError(f"tasks artifact must contain exactly one non-empty **{name}:** field")
        return matches[0].strip()

    def _parse_tasks(self) -> list[Task]:
        headers = list(TASK_HEADER_RE.finditer(self.text))
        if not headers:
            raise ConfigurationError("tasks artifact contains no task sections")
        tasks: list[Task] = []
        seen: set[str] = set()
        for index, header in enumerate(headers):
            task_id = header.group(1)
            if task_id in seen:
                raise ConfigurationError(f"duplicate task ID: {task_id}")
            seen.add(task_id)
            start = header.start()
            end = headers[index + 1].start() if index + 1 < len(headers) else len(self.text)
            body = self.text[start:end]
            fields: dict[str, list[str]] = {}
            for match in FIELD_RE.finditer(body):
                fields.setdefault(match.group("name").strip().lower(), []).append(match.group("value").strip())
            for required in ("status", "depends on", "external blocker"):
                values = fields.get(required, [])
                if len(values) != 1 or not values[0]:
                    raise ConfigurationError(f"{task_id} must contain exactly one non-empty **{required.title()}:** field")
            status = fields["status"][0].lower()
            if status not in VALID_STATUSES:
                raise ConfigurationError(f"{task_id} has invalid status: {status}")
            raw_dependencies = fields["depends on"][0]
            dependencies = () if raw_dependencies.lower() == "none" else tuple(
                item.strip() for item in raw_dependencies.split(",") if item.strip()
            )
            tasks.append(
                Task(
                    task_id=task_id,
                    title=header.group(2).strip(),
                    status=status,
                    depends_on=dependencies,
                    external_blocker=fields["external blocker"][0],
                    body=body,
                    start=start,
                    end=end,
                )
            )
        return tasks

    def _validate_graph(self) -> None:
        by_id = self.by_id
        for task in self.tasks:
            for dependency in task.depends_on:
                if dependency not in by_id:
                    raise ConfigurationError(f"{task.task_id} depends on unknown task {dependency}")
                if dependency == task.task_id:
                    raise ConfigurationError(f"{task.task_id} cannot depend on itself")
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(task_id: str) -> None:
            if task_id in visiting:
                raise ConfigurationError(f"dependency cycle includes {task_id}")
            if task_id in visited:
                return
            visiting.add(task_id)
            for dependency in by_id[task_id].depends_on:
                visit(dependency)
            visiting.remove(task_id)
            visited.add(task_id)

        for task in self.tasks:
            visit(task.task_id)
        self.assert_consistent_states()

    @property
    def by_id(self) -> dict[str, Task]:
        return {task.task_id: task for task in self.tasks}

    @staticmethod
    def blocker_is_none(task: Task) -> bool:
        return task.external_blocker.strip().lower() == "none"

    def derived_status(self, task: Task) -> str:
        if task.status in {"completed", "in_progress"}:
            return task.status
        dependencies_complete = all(self.by_id[item].status == "completed" for item in task.depends_on)
        return "ready" if dependencies_complete and self.blocker_is_none(task) else "blocked"

    def assert_consistent_states(self) -> None:
        for task in self.tasks:
            if task.status == "in_progress":
                raise ConfigurationError(
                    f"{task.task_id} is in_progress; v1 will not resume an interrupted task automatically"
                )
            if task.status == "completed":
                if not self.blocker_is_none(task):
                    raise ConfigurationError(f"completed task {task.task_id} still has an external blocker")
                missing = [item for item in task.depends_on if self.by_id[item].status != "completed"]
                if missing:
                    raise ConfigurationError(
                        f"completed task {task.task_id} has incomplete dependencies: {', '.join(missing)}"
                    )
                continue
            derived = self.derived_status(task)
            if task.status != derived:
                raise ConfigurationError(
                    f"{task.task_id} status is {task.status}, but its dependencies/blocker require {derived}"
                )

    def ready_tasks(self) -> list[Task]:
        return [task for task in self.tasks if task.status == "ready"]

    def incomplete_tasks(self) -> list[Task]:
        return [task for task in self.tasks if task.status != "completed"]

    def set_statuses(self, updates: Mapping[str, str]) -> None:
        for task_id, status in updates.items():
            if status not in VALID_STATUSES:
                raise ValueError(status)
            if task_id not in self.by_id:
                raise ValueError(task_id)
        pieces: list[str] = []
        cursor = 0
        for task in self.tasks:
            pieces.append(self.text[cursor : task.start])
            body = task.body
            if task.task_id in updates:
                body, count = re.subn(
                    r"^(\*\*Status:\*\*\s*)\S+\s*$",
                    rf"\g<1>{updates[task.task_id]}",
                    body,
                    count=1,
                    flags=re.MULTILINE,
                )
                if count != 1:
                    raise ConfigurationError(f"cannot update status for {task.task_id}")
            pieces.append(body)
            cursor = task.end
        pieces.append(self.text[cursor:])
        self.text = "".join(pieces)
        self.tasks = self._parse_tasks()

    def recompute_frontier(self) -> None:
        updates: dict[str, str] = {}
        by_id = self.by_id
        for task in self.tasks:
            if task.status == "completed":
                continue
            dependencies_complete = all(by_id[item].status == "completed" for item in task.depends_on)
            updates[task.task_id] = "ready" if dependencies_complete and self.blocker_is_none(task) else "blocked"
        self.set_statuses(updates)

    def write_atomic(self) -> None:
        atomic_write_text(self.path, self.text)


def atomic_write_text(path: Path, value: str) -> None:
    atomic_write_bytes(path, value.encode("utf-8"))


def atomic_write_bytes(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing_mode = stat.S_IMODE(path.stat().st_mode)
    except FileNotFoundError:
        existing_mode = None
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            if existing_mode is not None:
                os.fchmod(handle.fileno(), existing_mode)
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_text(path, json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n")


def validate_schema(instance: Any, schema: Mapping[str, Any], location: str = "$") -> None:
    expected = schema.get("type")
    if expected is not None:
        expected_types = expected if isinstance(expected, list) else [expected]
        checks = {
            "object": lambda value: isinstance(value, dict),
            "array": lambda value: isinstance(value, list),
            "string": lambda value: isinstance(value, str),
            "integer": lambda value: isinstance(value, int) and not isinstance(value, bool),
            "boolean": lambda value: isinstance(value, bool),
            "null": lambda value: value is None,
        }
        if not any(checks[item](instance) for item in expected_types):
            raise OperationalStop(f"structured output {location} must be {expected}")
    if "enum" in schema and instance not in schema["enum"]:
        raise OperationalStop(f"structured output {location} has unsupported value {instance!r}")
    if isinstance(instance, str) and len(instance) < schema.get("minLength", 0):
        raise OperationalStop(f"structured output {location} is too short")
    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0):
            raise OperationalStop(f"structured output {location} has too few items")
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(instance):
                validate_schema(item, item_schema, f"{location}[{index}]")
    if isinstance(instance, dict):
        properties = schema.get("properties", {})
        missing = [name for name in schema.get("required", []) if name not in instance]
        if missing:
            raise OperationalStop(f"structured output {location} is missing: {', '.join(missing)}")
        if schema.get("additionalProperties") is False:
            extra = sorted(set(instance) - set(properties))
            if extra:
                raise OperationalStop(f"structured output {location} has unknown fields: {', '.join(extra)}")
        for name, value in instance.items():
            if name in properties:
                validate_schema(value, properties[name], f"{location}.{name}")


def validate_semantics(phase: str, result: Mapping[str, Any]) -> None:
    if phase in {"IMPLEMENT", "REPAIR"}:
        decision = result["decision_required"]
        if result["result"] == "PASS" and decision is not None:
            raise OperationalStop(f"{phase} PASS cannot require a human decision")
        if result["result"] == "BLOCKED" and (not isinstance(decision, str) or not decision.strip()):
            raise OperationalStop(f"{phase} BLOCKED must include decision_required")
        return
    allowed = {"PASS": "NONE", "FAIL": "AUTO_FIX", "BLOCKED": "HUMAN_DECISION"}
    if result["action"] != allowed[result["verdict"]]:
        raise OperationalStop(
            f"{phase} invalid verdict/action combination: {result['verdict']}/{result['action']}"
        )
    decision = result["decision_required"]
    if result["verdict"] == "BLOCKED" and (not isinstance(decision, str) or not decision.strip()):
        raise OperationalStop(f"{phase} BLOCKED must include decision_required")
    if result["verdict"] != "BLOCKED" and decision is not None:
        raise OperationalStop(f"{phase} {result['verdict']} cannot include decision_required")
    if phase == "REVIEW":
        if result["verdict"] == "PASS" and result["findings"]:
            raise OperationalStop("REVIEW PASS must have no findings")
        if result["verdict"] == "FAIL" and not result["findings"]:
            raise OperationalStop("REVIEW FAIL must include findings")
    if phase == "VALIDATE":
        if result["verdict"] == "PASS":
            if not result["checks"]:
                raise OperationalStop("VALIDATE PASS must include at least one check")
            if any(check["status"] != "PASS" for check in result["checks"]):
                raise OperationalStop("VALIDATE PASS requires every check to PASS")
            if not result["evidence"]:
                raise OperationalStop("VALIDATE PASS must include evidence")
            if result["remaining_delta"]:
                raise OperationalStop("VALIDATE PASS must have no remaining_delta")
        if result["verdict"] == "FAIL" and not result["remaining_delta"]:
            raise OperationalStop("VALIDATE FAIL must include remaining_delta")


def normalized_fingerprint(value: Any) -> str:
    def normalize(item: Any) -> Any:
        if isinstance(item, str):
            return " ".join(item.split()).casefold()
        if isinstance(item, list):
            values = [normalize(child) for child in item]
            return sorted(values, key=lambda child: json.dumps(child, sort_keys=True, ensure_ascii=False))
        if isinstance(item, dict):
            return {key: normalize(item[key]) for key in sorted(item)}
        return item

    payload = json.dumps(normalize(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


class CycleRunner:
    def __init__(
        self,
        *,
        repo_root: Path,
        tasks_path: Path,
        task_id: str | None,
        max_repairs: int,
        runs_dir: Path,
        dry_run: bool,
        executor: Executor | None = None,
    ):
        self.repo_root = repo_root.resolve()
        self.tasks_path = tasks_path.resolve()
        self.task_id = task_id
        self.max_repairs = max_repairs
        self.runs_dir = runs_dir.resolve()
        self.dry_run = dry_run
        self.executor = executor or Executor()
        self.artifact = TaskArtifact.load(self.tasks_path)
        self.schemas = self._load_schemas()
        self.run_dir: Path | None = None
        self.mcp_servers: list[str] = []
        self.current_task: str | None = None
        self.summary: dict[str, Any] = {
            "cli_version": None,
            "model_policy": {
                "model": MODEL,
                "efforts": EFFORTS,
                "astra_executions": 0,
                "other_model_executions": 0,
            },
            "tasks_path": str(self.tasks_path),
            "requested_task": self.task_id,
            "executions": [],
            "repair_count": 0,
            "fingerprints": [],
            "stop_reason": None,
            "final_state": None,
        }
        self._validate_configuration()

    def _load_schemas(self) -> dict[str, Mapping[str, Any]]:
        schema_dir = Path(__file__).resolve().parent / "schemas"
        loaded: dict[str, Mapping[str, Any]] = {}
        for phase, filename in SCHEMA_FILES.items():
            if filename in loaded:
                continue
            path = schema_dir / filename
            try:
                loaded[filename] = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise ConfigurationError(f"invalid runner schema {path}: {exc}") from exc
        return {phase: loaded[filename] for phase, filename in SCHEMA_FILES.items()}

    def _validate_configuration(self) -> None:
        if self.max_repairs < 0:
            raise ConfigurationError("--max-repair-cycles must be zero or greater")
        if not within(self.tasks_path, self.repo_root):
            raise ConfigurationError("--tasks must resolve inside the repository")
        if self.runs_dir == self.repo_root:
            raise ConfigurationError("--runs-dir cannot be the repository root")
        if within(self.runs_dir, self.repo_root):
            relative_runs = self.runs_dir.relative_to(self.repo_root)
            tracked = self.executor.run(["git", "ls-files", "-z"], self.repo_root)
            if tracked.returncode != 0:
                raise ConfigurationError(f"cannot inspect tracked paths for --runs-dir: {tracked.stderr[-1000:]}")
            overlaps = []
            for raw in tracked.stdout.split("\0"):
                if not raw:
                    continue
                tracked_path = Path(raw)
                if (
                    tracked_path == relative_runs
                    or within(tracked_path, relative_runs)
                    or within(relative_runs, tracked_path)
                ):
                    overlaps.append(raw)
            if overlaps:
                raise ConfigurationError(
                    "--runs-dir overlaps tracked repository content: " + ", ".join(sorted(overlaps)[:5])
                )
        if self.task_id is not None and self.task_id not in self.artifact.by_id:
            raise ConfigurationError(f"unknown task ID: {self.task_id}")
        for raw_path in (self.artifact.spec_path, self.artifact.plan_path):
            resolved = (self.repo_root / raw_path).resolve()
            if not within(resolved, self.repo_root) or not resolved.is_file():
                raise ConfigurationError(f"referenced artifact does not exist inside the repository: {raw_path}")

    def run(self) -> int:
        if self.dry_run:
            self._print_dry_run()
            return 0
        self._create_run_dir()
        try:
            self._preflight()
            if self.task_id:
                task = self.artifact.by_id[self.task_id]
                if task.status != "ready":
                    raise OperationalStop(self._not_ready_reason(task))
                self._run_task(task.task_id)
                self.summary["final_state"] = "task_completed"
                self.summary["stop_reason"] = "requested task completed; feature validation omitted"
                self._checkpoint()
                return 0
            while self.artifact.incomplete_tasks():
                ready = self.artifact.ready_tasks()
                if not ready:
                    reasons = [self._not_ready_reason(task) for task in self.artifact.incomplete_tasks()]
                    raise OperationalStop("no ready tasks: " + "; ".join(reasons))
                self._run_task(ready[0].task_id)
            self.current_task = None
            self.summary["final_state"] = "feature_validation"
            self._checkpoint()
            feature = self._execute_phase("VALIDATE", task=None, context={"scope": "FEATURE"})
            if feature["verdict"] != "PASS":
                reason = feature["decision_required"] or "; ".join(feature["remaining_delta"]) or "feature validation failed"
                raise OperationalStop(f"global feature validation requires human escalation: {reason}")
            self.summary["final_state"] = "cycle_complete"
            self.summary["stop_reason"] = "all tasks and feature validation passed"
            self._checkpoint()
            return 0
        except KeyboardInterrupt:
            self.summary["stop_reason"] = "interrupted"
            self.summary["final_state"] = self._current_state()
            self._checkpoint()
            return 1
        except OperationalStop as exc:
            self.summary["stop_reason"] = str(exc)
            self.summary["final_state"] = self._current_state()
            self._checkpoint()
            print(f"sdd-cycle stopped: {exc}", file=sys.stderr)
            return 1

    def _create_run_dir(self) -> None:
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        prefix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
        for suffix in range(1000):
            candidate = self.runs_dir / (prefix if suffix == 0 else f"{prefix}-{suffix}")
            try:
                candidate.mkdir()
            except FileExistsError:
                continue
            self.run_dir = candidate
            self._checkpoint()
            return
        raise ConfigurationError("could not allocate a unique run directory")

    def _checkpoint(self) -> None:
        if self.run_dir is not None:
            atomic_write_json(self.run_dir / "summary.json", self.summary)

    def _current_state(self) -> str:
        if self.current_task and self.current_task in self.artifact.by_id:
            return f"{self.current_task}:{self.artifact.by_id[self.current_task].status}"
        return self.summary["final_state"] or "preflight"

    def _preflight(self) -> None:
        version = self.executor.run(["codex", "--version"], self.repo_root)
        if version.returncode != 0:
            raise OperationalStop(f"codex --version exited {version.returncode}")
        self.summary["cli_version"] = version.stdout.strip() or version.stderr.strip()
        catalog_result = self.executor.run(["codex", "debug", "models"], self.repo_root)
        if catalog_result.returncode != 0:
            raise OperationalStop(f"codex debug models exited {catalog_result.returncode}")
        try:
            catalog = json.loads(catalog_result.stdout)
        except json.JSONDecodeError as exc:
            raise OperationalStop(f"codex debug models returned invalid JSON: {exc}") from exc
        if not isinstance(catalog, dict) or not isinstance(catalog.get("models"), list):
            raise OperationalStop("codex debug models returned an unexpected catalog shape")
        candidates = [
            item for item in catalog["models"] if isinstance(item, dict) and item.get("slug") == MODEL
        ]
        if len(candidates) != 1:
            raise OperationalStop(f"model catalog does not contain exact slug {MODEL}")
        efforts = {item.get("effort") for item in candidates[0].get("supported_reasoning_levels", [])}
        if not {"medium", "xhigh"}.issubset(efforts):
            raise OperationalStop(f"{MODEL} catalog entry does not support medium and xhigh")
        mcp_result = self.executor.run(["codex", "mcp", "list", "--json"], self.repo_root)
        if mcp_result.returncode != 0:
            raise OperationalStop(f"codex mcp list --json exited {mcp_result.returncode}")
        try:
            servers = json.loads(mcp_result.stdout)
        except json.JSONDecodeError as exc:
            raise OperationalStop(f"codex mcp list --json returned invalid JSON: {exc}") from exc
        if not isinstance(servers, list):
            raise OperationalStop("codex mcp list --json did not return a list")
        discovered_servers = sorted(
            item["name"]
            for item in servers
            if isinstance(item, dict) and isinstance(item.get("name"), str) and item["name"]
        )
        self.mcp_servers = sorted(set(discovered_servers))
        self.summary["effective_mcp_servers_disabled"] = self.mcp_servers
        self._checkpoint()

    def _print_dry_run(self) -> None:
        simulated = {task.task_id: task.status for task in self.artifact.tasks}
        selected: list[str] = []
        if self.task_id:
            task = self.artifact.by_id[self.task_id]
            if task.status == "ready":
                selected.append(task.task_id)
        else:
            while True:
                next_task = next(
                    (
                        task
                        for task in self.artifact.tasks
                        if simulated[task.task_id] != "completed"
                        and TaskArtifact.blocker_is_none(task)
                        and all(simulated[item] == "completed" for item in task.depends_on)
                    ),
                    None,
                )
                if next_task is None:
                    break
                selected.append(next_task.task_id)
                simulated[next_task.task_id] = "completed"
        blocked = [task.task_id for task in self.artifact.tasks if simulated[task.task_id] != "completed"]
        print(json.dumps({"dry_run": True, "tasks": selected, "blocked": blocked, "feature_validation": not self.task_id}, indent=2))

    def _not_ready_reason(self, task: Task) -> str:
        if not self.artifact.blocker_is_none(task):
            return f"{task.task_id} external blocker: {task.external_blocker}"
        incomplete = [item for item in task.depends_on if self.artifact.by_id[item].status != "completed"]
        if incomplete:
            return f"{task.task_id} waiting for dependencies: {', '.join(incomplete)}"
        return f"{task.task_id} has state {task.status}"

    def _run_task(self, task_id: str) -> None:
        self.current_task = task_id
        self.artifact.set_statuses({task_id: "in_progress"})
        self.artifact.write_atomic()
        self.summary["final_state"] = f"{task_id}:in_progress"
        self._checkpoint()
        before_implementation = self._repository_snapshot()
        implementation = self._execute_phase("IMPLEMENT", task=self.artifact.by_id[task_id], context={})
        after_implementation = self._repository_snapshot()
        implementation_paths = self._changed_paths(before_implementation, after_implementation)
        self._record_reported_delta("IMPLEMENT", implementation["files_modified"], implementation_paths)
        if implementation["result"] == "BLOCKED":
            raise OperationalStop(f"{task_id} implementation needs human decision: {implementation['decision_required']}")
        modified_paths = set(implementation_paths)
        previous_review: str | None = None
        previous_delta: str | None = None
        repair_count = 0
        repair_context: dict[str, Any] | None = None
        while True:
            if repair_context is not None:
                if repair_count >= self.max_repairs:
                    raise OperationalStop(f"{task_id} reached repair limit {self.max_repairs}")
                before = self._repository_snapshot()
                repair = self._execute_phase("REPAIR", task=self.artifact.by_id[task_id], context=repair_context)
                repair_count += 1
                self.summary["repair_count"] += 1
                after = self._repository_snapshot()
                repair_paths = self._changed_paths(before, after)
                self._record_reported_delta("REPAIR", repair["files_modified"], repair_paths)
                modified_paths.update(repair_paths)
                before_fingerprint = self._snapshot_fingerprint(before)
                after_fingerprint = self._snapshot_fingerprint(after)
                self.summary["fingerprints"].append(
                    {"task": task_id, "kind": "repair", "before": before_fingerprint, "after": after_fingerprint}
                )
                self._checkpoint()
                if repair["result"] == "BLOCKED":
                    raise OperationalStop(f"{task_id} repair needs human decision: {repair['decision_required']}")
                if before_fingerprint == after_fingerprint:
                    raise OperationalStop(f"{task_id} repair made no repository progress")
                repair_context = None
            review = self._execute_phase(
                "REVIEW",
                task=self.artifact.by_id[task_id],
                context={"modified_paths": sorted(modified_paths)},
            )
            if review["verdict"] == "BLOCKED":
                raise OperationalStop(f"{task_id} review needs human decision: {review['decision_required']}")
            if review["verdict"] == "FAIL":
                fingerprint = normalized_fingerprint(review["findings"])
                if previous_review == fingerprint:
                    raise OperationalStop(f"{task_id} repeated the same review findings")
                previous_review = fingerprint
                repair_context = {"source": "REVIEW", "findings": review["findings"]}
                continue
            previous_review = None
            validation = self._execute_phase("VALIDATE", task=self.artifact.by_id[task_id], context={"scope": "TASK"})
            if validation["verdict"] == "BLOCKED":
                raise OperationalStop(f"{task_id} validation needs human decision: {validation['decision_required']}")
            if validation["verdict"] == "FAIL":
                fingerprint = normalized_fingerprint(validation["remaining_delta"])
                if previous_delta == fingerprint:
                    raise OperationalStop(f"{task_id} repeated the same validation delta")
                previous_delta = fingerprint
                repair_context = {"source": "VALIDATE", "remaining_delta": validation["remaining_delta"]}
                continue
            self.artifact.set_statuses({task_id: "completed"})
            self.artifact.recompute_frontier()
            self.artifact.write_atomic()
            self.summary["final_state"] = f"{task_id}:completed"
            self._checkpoint()
            return

    def _execute_phase(self, phase: str, task: Task | None, context: Mapping[str, Any]) -> Mapping[str, Any]:
        assert self.run_dir is not None
        phase_number = len(self.summary["executions"]) + 1
        phase_dir = self.run_dir / f"{phase_number:02d}-{phase.lower()}"
        phase_dir.mkdir()
        schema_path = Path(__file__).resolve().parent / "schemas" / SCHEMA_FILES[phase]
        answer_path = phase_dir / "result.json"
        prompt = self._prompt(phase, task, context)
        argv = self._build_argv(phase, schema_path, answer_path)
        self._assert_execution_policy(phase, argv)
        record: dict[str, Any] = {
            "task": task.task_id if task else None,
            "phase": phase,
            "model": MODEL,
            "effort": EFFORTS[phase],
            "sandbox": SANDBOXES[phase],
            "argv": argv,
            "exit_code": None,
            "result": None,
            "repair_count": self.summary["repair_count"],
        }
        self.summary["executions"].append(record)
        self._checkpoint()
        protected = self._protected_artifacts()
        repository_before = self._repository_snapshot() if phase == "VALIDATE" else None
        try:
            result = self.executor.run(argv, self.repo_root, stdin=prompt)
        except BaseException:
            restored = self._restore_protected_artifacts(protected)
            if restored:
                self.summary["protected_artifacts_restored"] = restored
                self._checkpoint()
            raise
        record["exit_code"] = result.returncode
        atomic_write_text(phase_dir / "stderr.log", result.stderr[-LOG_LIMIT:])
        tampered = self._restore_protected_artifacts(protected)
        if tampered:
            self._checkpoint()
            raise OperationalStop(f"{phase} attempted unauthorized artifact changes: {', '.join(tampered)}")
        if repository_before is not None:
            validation_changes = self._changed_paths(repository_before, self._repository_snapshot())
            if validation_changes:
                record["repository_changes"] = validation_changes
                self._checkpoint()
                raise OperationalStop(
                    "VALIDATE changed tracked or non-ignored files: " + ", ".join(validation_changes)
                )
        if result.returncode != 0:
            self._checkpoint()
            raise OperationalStop(f"{phase} child process exited {result.returncode}")
        try:
            structured = json.loads(answer_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            self._checkpoint()
            raise OperationalStop(f"{phase} returned invalid structured output: {exc}") from exc
        validate_schema(structured, self.schemas[phase])
        validate_semantics(phase, structured)
        if phase == "VALIDATE":
            expected_scope = context["scope"]
            if structured["scope"] != expected_scope:
                raise OperationalStop(f"VALIDATE returned scope {structured['scope']}; expected {expected_scope}")
        if phase in {"IMPLEMENT", "REPAIR"}:
            self._validate_reported_paths(structured["files_modified"])
        record["result"] = structured
        self._checkpoint()
        return structured

    def _protected_artifacts(self) -> dict[Path, bytes]:
        paths = [
            self.tasks_path,
            (self.repo_root / self.artifact.spec_path).resolve(),
            (self.repo_root / self.artifact.plan_path).resolve(),
        ]
        try:
            return {path: path.read_bytes() for path in paths}
        except OSError as exc:
            raise OperationalStop(f"cannot snapshot protected SDD artifacts: {exc}") from exc

    def _restore_protected_artifacts(self, expected: Mapping[Path, bytes]) -> list[str]:
        changed: list[str] = []
        for path, content in expected.items():
            try:
                current = path.read_bytes()
            except OSError:
                current = None
            if current != content:
                atomic_write_bytes(path, content)
                changed.append(str(path.relative_to(self.repo_root)))
        return changed

    def _build_argv(self, phase: str, schema_path: Path, answer_path: Path) -> list[str]:
        argv = [
            "codex",
            "--ask-for-approval",
            "never",
            "exec",
            "--ephemeral",
            "--ignore-user-config",
            "--strict-config",
            "--model",
            MODEL,
            "-c",
            f'model_reasoning_effort="{EFFORTS[phase]}"',
            "-c",
            'web_search="disabled"',
            "-c",
            "sandbox_workspace_write.network_access=false",
        ]
        for server in self.mcp_servers:
            argv.extend(["-c", f"mcp_servers.{json.dumps(server, ensure_ascii=False)}.enabled=false"])
        for feature in DISABLED_FEATURES:
            argv.extend(["--disable", feature])
        argv.extend(
            [
                "--sandbox",
                SANDBOXES[phase],
                "--cd",
                str(self.repo_root),
                "--output-schema",
                str(schema_path),
                "--output-last-message",
                str(answer_path),
                "-",
            ]
        )
        return argv

    def _assert_execution_policy(self, phase: str, argv: Sequence[str]) -> None:
        def values(flag: str) -> list[str]:
            return [argv[index + 1] for index, item in enumerate(argv[:-1]) if item == flag]

        if list(argv[:4]) != ["codex", "--ask-for-approval", "never", "exec"]:
            raise OperationalStop("unauthorized Codex command or approval policy")
        if values("--model") != [MODEL]:
            raise OperationalStop("execution violates the fixed model policy")
        expected_effort = f'model_reasoning_effort="{EFFORTS[phase]}"'
        if expected_effort not in values("-c"):
            raise OperationalStop("execution violates the reasoning effort policy")
        if values("--sandbox") != [SANDBOXES[phase]]:
            raise OperationalStop("execution violates the sandbox policy")
        required = {"--ephemeral", "--ignore-user-config", "--strict-config", "--output-schema", "--output-last-message"}
        if not required.issubset(argv):
            raise OperationalStop("execution is missing required isolation/output flags")
        if 'web_search="disabled"' not in values("-c"):
            raise OperationalStop("execution did not disable web search")
        disabled = values("--disable")
        if not set(DISABLED_FEATURES).issubset(disabled):
            raise OperationalStop("execution did not disable every required optional capability")
        configs = values("-c")
        network_configs = [item for item in configs if item.startswith("sandbox_workspace_write.network_access=")]
        if network_configs != ["sandbox_workspace_write.network_access=false"]:
            raise OperationalStop("execution did not disable workspace-write network access")
        expected_mcp_overrides = {
            f"mcp_servers.{json.dumps(server, ensure_ascii=False)}.enabled=false" for server in self.mcp_servers
        }
        mcp_configs = [item for item in configs if item == "mcp_servers={}" or item.startswith("mcp_servers.")]
        if len(mcp_configs) != len(expected_mcp_overrides) or set(mcp_configs) != expected_mcp_overrides:
            raise OperationalStop("execution did not disable every discovered MCP server")
        if any(item in argv for item in ("resume", "fork")):
            raise OperationalStop("execution attempted to reuse a Codex session")
        models = values("--model")
        if any(model == "gpt-6-astra" for model in models):
            self.summary["model_policy"]["astra_executions"] += 1
        if any(model != MODEL for model in models):
            self.summary["model_policy"]["other_model_executions"] += 1
        if self.summary["model_policy"]["astra_executions"] or self.summary["model_policy"]["other_model_executions"]:
            raise OperationalStop("execution audit detected a forbidden model")

    def _prompt(self, phase: str, task: Task | None, context: Mapping[str, Any]) -> str:
        artifacts = {
            "tasks": str(self.tasks_path.relative_to(self.repo_root)),
            "spec": self.artifact.spec_path,
            "plan": self.artifact.plan_path,
        }
        common = [
            "SDD_RUNNER_MODE: true",
            f"SDD_RUNNER_PHASE: {phase}",
            "The runner owns task lifecycle state. Do not edit Status fields in tasks.md.",
            "Use only local repository tools. Do not use agents, apps, plugins, MCP, hooks, browser, computer use, web search, or install dependencies.",
            f"Artifacts: {json.dumps(artifacts, sort_keys=True)}",
        ]
        if task:
            common.extend(
                [
                    f"Task ID: {task.task_id}",
                    "Task contract:",
                    task.body.strip(),
                ]
            )
        if phase == "IMPLEMENT":
            common.extend(
                [
                    "Invoke and follow $sdd-implement in runner-owned IMPLEMENT mode.",
                    "Implement only this task. Return the structured result; do not claim review or final validation.",
                    f"Repository fingerprint before phase: {self._repository_fingerprint()}",
                ]
            )
        elif phase == "REPAIR":
            common.extend(
                [
                    "Invoke and follow $sdd-implement in runner-owned REPAIR mode.",
                    "Make the smallest changes that address only the supplied feedback.",
                    f"Repair input: {json.dumps(context, sort_keys=True)}",
                ]
            )
        elif phase == "REVIEW":
            modified_paths = context["modified_paths"]
            common.extend(
                [
                    "Invoke and follow $sdd-review in runner-owned REVIEW mode.",
                    "Do not modify files. Review SPEC, STANDARDS, and SIMPLICITY independently.",
                    f"Modified paths: {json.dumps(modified_paths)}",
                    "Bounded runner-generated diff:",
                    self._bounded_diff(modified_paths),
                ]
            )
        else:
            scope = context["scope"]
            common.extend(
                [
                    "Invoke and follow $sdd-validate in runner-owned VALIDATE mode.",
                    f"Validation scope: {scope}",
                    "Run fresh, acceptance-linked checks. Do not repair failures.",
                    f"Current repository state: {self._repository_fingerprint()}",
                ]
            )
        return "\n\n".join(common) + "\n"

    def _git(self, *args: str) -> CommandResult:
        result = self.executor.run(["git", *args], self.repo_root)
        if result.returncode != 0:
            raise OperationalStop(f"git {' '.join(args)} exited {result.returncode}: {result.stderr[-1000:]}")
        return result

    def _repository_fingerprint(self) -> str:
        return self._snapshot_fingerprint(self._repository_snapshot())

    def _repository_snapshot(self) -> dict[str, str]:
        paths = self._git(
            "ls-files", "--cached", "--others", "--exclude-standard", "-z", *self._git_scope()
        ).stdout.split("\0")
        index_entries: dict[str, list[str]] = {}
        for entry in self._git("ls-files", "--stage", "-z", *self._git_scope()).stdout.split("\0"):
            if not entry:
                continue
            metadata, raw = entry.split("\t", 1)
            index_entries.setdefault(raw, []).append(metadata)
        snapshot: dict[str, str] = {}
        for raw in sorted(set(paths) | set(index_entries)):
            if not raw:
                continue
            path = self.repo_root / raw
            digest = hashlib.sha256()
            for metadata in sorted(index_entries.get(raw, [])):
                digest.update(b"index\0")
                digest.update(metadata.encode("utf-8"))
            try:
                file_stat = path.lstat()
            except FileNotFoundError:
                digest.update(b"missing")
            except OSError as exc:
                raise OperationalStop(f"cannot inspect repository path {raw}: {exc}") from exc
            else:
                digest.update(str(stat.S_IFMT(file_stat.st_mode)).encode("ascii"))
                digest.update(str(stat.S_IMODE(file_stat.st_mode)).encode("ascii"))
                try:
                    if stat.S_ISLNK(file_stat.st_mode):
                        digest.update(os.readlink(path).encode("utf-8", errors="surrogateescape"))
                    elif stat.S_ISREG(file_stat.st_mode):
                        digest.update(path.read_bytes())
                    else:
                        digest.update(b"non-regular")
                except OSError as exc:
                    raise OperationalStop(f"cannot fingerprint repository path {raw}: {exc}") from exc
            snapshot[raw] = digest.hexdigest()
        return snapshot

    @staticmethod
    def _snapshot_fingerprint(snapshot: Mapping[str, str]) -> str:
        payload = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def _changed_paths(before: Mapping[str, str], after: Mapping[str, str]) -> list[str]:
        return sorted(path for path in set(before) | set(after) if before.get(path) != after.get(path))

    def _record_reported_delta(self, phase: str, reported: Iterable[str], actual: Sequence[str]) -> None:
        reported_paths = sorted(self._normalized_reported_paths(reported))
        record = self.summary["executions"][-1]
        if record["phase"] != phase:
            raise OperationalStop(f"cannot audit repository delta for {phase}")
        record["reported_files_modified"] = reported_paths
        record["actual_files_modified"] = list(actual)
        record["files_modified_match"] = reported_paths == list(actual)
        self._checkpoint()

    def _bounded_diff(self, paths: Sequence[str]) -> str:
        if not paths:
            return "[no modified paths reported]"
        pathspecs = [f":(literal){raw}" for raw in paths]
        diff = self._git("diff", "--no-ext-diff", "--unified=3", "HEAD", "--", *pathspecs).stdout
        remaining = DIFF_LIMIT - len(diff)
        if remaining > 0:
            chunks: list[str] = [diff]
            untracked = set(
                self._git("ls-files", "--others", "--exclude-standard", "-z", "--", *pathspecs).stdout.split("\0")
            )
            for raw in paths:
                if not raw or remaining <= 0:
                    continue
                if raw not in untracked:
                    continue
                path = (self.repo_root / raw).resolve()
                if not within(path, self.repo_root) or not path.is_file():
                    continue
                try:
                    sample = path.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                addition = f"\n--- /dev/null\n+++ b/{raw}\n{sample}"
                chunks.append(addition[:remaining])
                remaining -= len(addition)
            diff = "".join(chunks)
        if len(diff) > DIFF_LIMIT:
            return diff[:DIFF_LIMIT] + "\n[diff truncated by sdd_cycle]\n"
        return diff or "[no textual diff]"

    def _git_scope(self) -> tuple[str, ...]:
        scope = ["--", "."]
        if self.run_dir is not None and within(self.run_dir, self.repo_root):
            relative = self.run_dir.relative_to(self.repo_root).as_posix()
            scope.append(f":(exclude){relative}/**")
        return tuple(scope)

    def _validate_reported_paths(self, paths: Iterable[str]) -> None:
        protected = {
            self.tasks_path,
            (self.repo_root / self.artifact.spec_path).resolve(),
            (self.repo_root / self.artifact.plan_path).resolve(),
        }
        for raw in paths:
            path = (self.repo_root / raw).resolve()
            if Path(raw).is_absolute() or not within(path, self.repo_root):
                raise OperationalStop(f"unauthorized modified path reported: {raw}")
            if path in protected or within(path, self.runs_dir):
                raise OperationalStop(f"unauthorized modified path reported: {raw}")

    def _normalized_reported_paths(self, paths: Iterable[str]) -> set[str]:
        normalized: set[str] = set()
        for raw in paths:
            path = (self.repo_root / raw).resolve()
            normalized.add(path.relative_to(self.repo_root).as_posix())
        return normalized


def repository_root(start: Path) -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=start,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        raise ConfigurationError("run sdd_cycle.py inside a Git repository")
    return Path(result.stdout.strip()).resolve()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", required=True, type=Path, help="Path to the feature tasks.md artifact")
    parser.add_argument("--task", dest="task_id", help="Run only one ready task and omit feature validation")
    parser.add_argument("--max-repair-cycles", type=int, default=3)
    parser.add_argument("--runs-dir", type=Path, help="Audit output directory (default: sdd/runner/runs)")
    parser.add_argument("--dry-run", action="store_true", help="Print the planned order without Codex or mutations")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        root = repository_root(Path.cwd())
        tasks = args.tasks if args.tasks.is_absolute() else Path.cwd() / args.tasks
        runs = args.runs_dir or root / "sdd" / "runner" / "runs"
        if not runs.is_absolute():
            runs = Path.cwd() / runs
        runner = CycleRunner(
            repo_root=root,
            tasks_path=tasks,
            task_id=args.task_id,
            max_repairs=args.max_repair_cycles,
            runs_dir=runs,
            dry_run=args.dry_run,
        )
        return runner.run()
    except ConfigurationError as exc:
        print(f"sdd-cycle configuration error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
