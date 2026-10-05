---
name: sdd-change
description: Propagate an approved requirement or design change through active SDD artifacts without losing unaffected decisions. Use when scope or behavior changes after specification, planning, tasking, or partial implementation.
---

# SDD Change

Treat change as a traceable delta, not a reason to regenerate everything.

## Procedure

1. Identify the active specification, plan, optional UI design, tasks, relevant architecture or ADRs, implementation state, and existing validation evidence.
2. Capture the requested delta explicitly:
   - Previous behavior or decision.
   - New behavior or decision.
   - Reason and source of authority.
   - Effective scope and compatibility expectations.
3. Inspect repository evidence when the impact is uncertain. Follow the context and tool policies in `sdd/POLICIES.md`; do not infer affected surfaces only from document names.
4. Build an impact map across:
   - Goals, non-goals, requirements, acceptance criteria, and edge cases.
   - UI design and interaction states.
   - Architecture and durable decisions.
   - Plan, risks, migration, rollout, and rollback.
   - Tasks, dependencies, statuses, and ready frontier.
   - Code, tests, documentation, review findings, and validation evidence.
5. Update the specification first. Preserve stable IDs when meaning remains stable; add or retire IDs explicitly when it changes. Record significant change history.
6. Update only affected downstream artifacts in order: UI or architecture/ADR when applicable, plan, then tasks. Reclassify the plan's change profile and full-validation decision when impact changes.
7. Recompute dependencies and statuses. Reopen completed tasks when their outcome is invalidated and mark stale validation evidence as such.
8. Report implementation areas that now diverge from the contract. Do not implement them unless separately requested.

## Boundaries

- Preserve unaffected decisions and traceability.
- Do not disguise a new requirement as a planning detail.
- Create or amend an ADR only when the change affects a durable, consequential decision.
- Do not retain obsolete tasks or evidence as current.

## Report

Summarize the delta, impacted artifacts, IDs added or retired, reopened or blocked tasks, invalidated evidence, implementation impact, and new ready frontier.
