---
name: sdd-tasks
description: Decompose an approved SDD plan into outcome-oriented, dependency-aware tasks with validation evidence. Use when implementation work needs a ready frontier, requirement traceability, and a clear completion contract.
---

# SDD Tasks

Create a small execution graph whose tasks deliver verifiable outcomes rather than merely touching files.

## Procedure

1. Read the active specification, plan, applicable instructions, and UI design when one is required.
2. Start from `sdd/templates/tasks.md`. Keep the status vocabulary:
   - `ready`: incomplete, not active, without an external blocker, and every dependency is completed.
   - `blocked`: at least one dependency is incomplete or an external blocker is explicit.
   - `in_progress`: implementation is actively underway.
   - `completed`: the task's validation evidence has passed.
   - Every task must include `**External blocker:** none | <reason>`. Use `none` when no external fact or decision blocks execution; never infer absence from a missing field.
3. Prefer vertical slices that produce coherent behavior and evidence. Use enabling tasks only when a genuine dependency cannot be delivered as part of a slice.
4. For each task record:
   - Stable ID and outcome-oriented title.
   - Dependencies by task ID.
   - An explicit external blocker value.
   - Requirement and acceptance-criterion IDs covered.
   - Observable outcome and likely affected areas.
   - Specific validation evidence.
   - Notes only when they prevent ambiguity.
5. Order tasks by dependencies, risk reduction, and delivery value. Keep independently executable work independent.
6. Verify the graph:
   - No cycles or nonexistent dependencies.
   - Every required acceptance criterion has task coverage.
   - No orphan task lacks a requirement, risk, or necessary enabling purpose.
   - The initial ready frontier is accurate.
   - Every incomplete task with an external blocker is `blocked`; every unblocked task whose dependencies are complete is `ready`.
   - The number and size of tasks are proportional to the work.

## Boundaries

- Do not create one task per file, empty coordination tasks, or speculative future work.
- Do not mandate commits, worktrees, agents, or test-first sequencing unless the repository or plan requires them.
- A task is not completed because code exists; its stated validation must pass.

## Report

State the task file path, task count, ready frontier, dependency chain, acceptance coverage, and any blocked work.
