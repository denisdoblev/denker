# Lightweight Spec-Driven Development for Codex

This framework turns project intent into persistent, traceable engineering artifacts without making the process heavier than the work. It combines a small documentation model with explicitly invoked Codex Agent Skills.

> The SDD system must not become more complex than the development problem it is intended to simplify.

> Do not create a new skill, artifact, abstraction, or workflow unless a recurring problem demonstrates the need for it.

## What lives where

- `AGENTS.md` routes Codex to the minimum relevant context and defines the global Definition of Done.
- `docs/constitution.md` holds stable principles.
- `docs/architecture.md` describes the current system, boundaries, dependencies, and trade-offs.
- `docs/conventions.md` records project-specific implementation rules that should not be guessed.
- `docs/glossary.md` is optional and exists only when domain language needs alignment.
- `docs/adr/` holds consequential, durable decisions with real alternatives.
- `specs/<feature>/spec.md` defines what and why.
- `specs/<feature>/plan.md` defines how.
- `specs/<feature>/tasks.md` defines executable outcomes and their dependency graph.
- `specs/<feature>/ui.md` may hold a Screen Specification when `$ui-design` is warranted.
- `sdd/templates/` contains framework templates, not project artifacts.
- `sdd/POLICIES.md` is the canonical on-demand policy for context, tools, validation, and optional memory.
- `.agents/skills/` contains the workflow Skills.

Create glossary and ADR artifacts lazily. Empty documentation is not progress.

## Adopt in an existing repository

The framework files must be present in the target repository before Codex can discover `$sdd-init`:

1. Merge this framework's `.agents/skills/` and `sdd/` directories into the target repository root. Inspect collisions and preserve existing project material; do not overwrite it blindly.
2. Do not copy this repository's root `AGENTS.md`: it governs development of the framework itself. Preserve any target-project instructions already in place.
3. From the target repository root, invoke `$sdd-init`. It will inspect the real topology and create or merge only the useful project artifacts.

Adoption requires no package installation, framework CLI, database, or generated product code.

## Minimum necessary process

Classify by uncertainty, blast radius, reversibility, architectural and migration impact, domain complexity, and user impact—not by file count.

- **Trivial:** direct change plus proportionate verification. Examples: typo, isolated label, obvious low-risk adjustment.
- **Standard:** specify → plan → tasks → implement → review → validate. Run clarify or UI design only when needed.
- **Architectural/high-risk:** add architecture analysis, ADRs, migration and compatibility strategy, stronger testing, and rollout evidence as the risk requires.

The Skills are explicit-only. Current Codex supports invocation as `$skill-name`.

## Workflow

```text
init (once per project)
  ↓
specify
  ↓
clarify        optional: only material unresolved decisions
  ↓
plan
  ↓
ui-design      optional: only meaningful UI/UX work
  ↓
tasks
  ↓
implement
  ↓
review
  ↓
validate
```

After specification, `$sdd-change` is an available lateral propagation route whenever an approved requirement or design changes. It is not a mandatory terminal stage: it updates only invalidated artifacts and work, then returns the change to the appropriate workflow stage.

### Optional bounded runner

For a feature that already has an accepted `tasks.md`, the standard-library runner can execute the implementation tail sequentially:

```text
python3 sdd/runner/sdd_cycle.py --tasks specs/<feature>/tasks.md [--task T3]
```

Each task must include `**External blocker:** none | <reason>`. The runner rejects missing or inconsistent state before changing a task. It processes ready tasks in document order through fresh `IMPLEMENT → REVIEW → VALIDATE` Codex processes, with bounded `REPAIR → REVIEW` loops for repairable findings or validation deltas. `--task` runs one ready task and omits feature validation; `--dry-run` prints the reachable order without invoking Codex, creating audit files, or changing states.

The model policy is fixed: `gpt-5.6-sol` with `xhigh` for REVIEW and `medium` elsewhere. Preflight verifies the installed catalog before `ready → in_progress`; no alternate model, downgrade, resume, or fork is allowed. Runs use explicit sandbox and approval settings, structured output schemas, ephemeral sessions, disabled network/search and optional agent integrations, and an explicit `enabled=false` override for every MCP server discovered locally.

Audit checkpoints live under the Git-ignored `sdd/runner/runs/` by default. A custom audit root cannot overlap tracked content, and only the directory allocated for the current run is omitted from repository snapshots. Checkpoints contain bounded diagnostics, structured results, declared-versus-actual file deltas, policy and repository fingerprints, repair counts, stop reason, and final state—not full transcripts. Validation must leave tracked and non-ignored files unchanged. An interrupted or failed active task remains `in_progress`; v1 requires a human to reconcile that state before another run. A full cycle ends with feature-scope validation, and any failure there is escalated without reopening a task automatically.

Public options are `--tasks`, `--task`, `--max-repair-cycles` (default `3`), `--runs-dir`, and `--dry-run`. Exit codes are `0` for success or a valid dry-run, `1` for a safe operational stop, and `2` for invalid usage or artifact configuration.

### Skills

| Skill | Outcome |
| --- | --- |
| `$sdd-init` | Adapt the documentation layout to an existing simple repo or monorepo without overwriting useful material. |
| `$sdd-specify` | Produce a proportional WHAT/WHY spec with traceable requirements and acceptance criteria. |
| `$sdd-clarify` | Resolve only material ambiguities that the repository cannot answer. |
| `$sdd-plan` | Produce the minimum viable HOW, including risk, validation, and UI/ADR decisions. |
| `$ui-design` | Specify significant product UI/UX independently from technical implementation. |
| `$sdd-tasks` | Build a dependency-aware graph of verifiable implementation outcomes. |
| `$sdd-implement` | Implement a ready task within its agreed scope and report deviations. |
| `$sdd-review` | Review independently along SPEC, STANDARDS, and SIMPLICITY axes. |
| `$sdd-validate` | Test completion claims against fresh evidence and the Definition of Done. |
| `$sdd-change` | Propagate a changed requirement through affected artifacts and implementation. |

## Tools by stage

Tool use is conditional, not ceremonial. `$sdd-init` discovers tools already present in the consumer repository but never installs tools, dependencies, Skills, plugins, or MCP servers automatically. `sdd/POLICIES.md` is the canonical trigger, anti-trigger, and fallback registry.

| Stage | Typical tool classes |
| --- | --- |
| init | Base discovery: filesystem, `rg`, Git when informative, manifests, configuration, and CI. |
| specify / clarify | Repository search and focused reads; targeted official sources only when local evidence cannot settle a relevant fact. |
| plan / change | Base tools first; optional semantic, architecture, or versioned-documentation tools only when the affected surface justifies them. |
| ui-design | Existing product/design-system evidence; browser or design tooling only for real UI scope. |
| tasks | Existing artifacts and dependency evidence; no implementation tooling by default. |
| implement | Language/project tools and focused tests; syntax or semantic tools only when they reduce uncertainty. |
| review | Diff, focused reads, and risk-specific analyzers without silently modifying the change. |
| validate | Acceptance-linked checks selected from the declared change profile; full suites only with an explicit reason. |

- **Base:** local deterministic tools such as `git`, `rg`, and range reads. They require a relevant evidentiary question, not ritual execution.
- **Optional:** Graphify, Serena, Context7, dependency-cruiser, ast-grep, Knip, Semgrep, and Playwright when their documented triggers match the consumer project.
- **Last resort or not recommended here:** Repomix is a budgeted multifile fallback. Engram and Cavecrew/Caveman are not SDD integrations. Every non-base option has a native fallback.

## Progressive disclosure

Do not read all documentation before every change. `AGENTS.md` routes context:

- Read architecture for boundary, dependency, infrastructure, integration, or cross-component changes.
- Read conventions for implementation in the affected scope.
- Read the glossary when domain terminology affects the work.
- Read relevant ADRs when a prior durable decision may constrain the work.
- Read the active spec/plan/tasks only for a feature managed through SDD.
- Read a Skill reference only when the Skill names the mode that requires it.

Nearest scoped documentation takes precedence over global documentation unless it conflicts with the constitution.

For a common search and stopping order, tool selection, validation profiles, baseline handling, and memory precedence, read only the relevant section of `sdd/POLICIES.md`.

## Simple repository and monorepo layouts

A typical simple repository uses:

```text
AGENTS.md
docs/
  constitution.md
  architecture.md
  conventions.md
  glossary.md        optional
  adr/               created with the first ADR
specs/
```

A monorepo keeps constitution and cross-system architecture global, while local architecture, conventions, and routing live near scopes that genuinely differ. Place glossary entries and ADRs in the nearest scope their language or decision governs; keep them global only when they are cross-system:

```text
AGENTS.md
docs/{constitution,architecture,glossary}.md
docs/adr/
apps/web/{AGENTS.md,docs/architecture.md,docs/conventions.md}
services/api/{AGENTS.md,docs/architecture.md,docs/conventions.md}
packages/...
specs/
```

Feature specs stay organized by user-facing change rather than by technical owner. Avoid duplicating global content in local files.

## Example

```text
$sdd-specify Add product comparison for signed-in shoppers
$sdd-plan
$ui-design        # plan marked "UI design required: yes"
$sdd-tasks
$sdd-implement T1
$sdd-review
$sdd-validate
```

For a small backend-only change, omit `$ui-design`. For a typo, omit the SDD workflow entirely.

## Evolving the framework

Add structure only after repeated real use demonstrates a gap. Prefer narrowing an existing Skill or template to adding a new one. When upstream-derived behavior changes, verify the official current source and update `UPSTREAM.md`. Never trade a shorter product task for a longer framework ritual.
