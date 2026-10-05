---
name: sdd-implement
description: Implement one or more ready SDD tasks against their specification, plan, and repository conventions. Use when scoped product changes should be made with proportional checks and task status backed by fresh evidence.
---

# SDD Implement

Implement a requested or ready task against the accepted contract.

## Procedure

1. Identify the requested task or select and state one ready task. Do not begin blocked work.
2. Verify its dependencies and change its status to `in_progress`.
3. Load only the context it links to, following the stopping rule in `sdd/POLICIES.md`: relevant requirements and acceptance criteria, plan section, optional UI design, instructions, conventions, architecture, glossary terms, and ADRs.
4. Inspect implementation and tests at the responsible layer. Reuse established patterns before adding abstractions or dependencies.
5. Make the smallest coherent change that satisfies the task outcome. Preserve unrelated behavior and user changes.
6. Add or update tests in proportion to risk, established project practice, and the task's validation contract. Test-first sequencing is optional unless locally required.
7. Run the focused checks named by the task. Apply the plan's change profile and `sdd/POLICIES.md`; broaden checks only when shared boundaries, risk, or repository policy warrants it, and separate new regressions from baseline failures.
   - When a check fails unexpectedly, gather evidence and identify the root cause before changing code; do not patch the nearest symptom by guesswork.
8. If evidence reveals a material deviation:
   - Do not silently improvise a new requirement.
   - Use `$sdd-change` for a changed contract.
   - Revisit `$sdd-plan` when the accepted technical approach is invalid.
9. Mark the task `completed` only after its validation passes. Recompute the ready frontier. Implementation completion does not imply feature validation.

## Boundaries

- Do not expand into nearby cleanup or speculative infrastructure.
- Do not claim checks that were not run or hide failing output.
- Do not mark dependent tasks ready until every blocker is completed.

## Report

Describe the outcome, files changed, task status, commands and results, deviations, remaining risks, and next ready tasks. Route the completed feature to `$sdd-review`, then `$sdd-validate`.
