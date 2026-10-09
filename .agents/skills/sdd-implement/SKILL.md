---
name: sdd-implement
description: Implement one or more ready SDD tasks, then complete the default review-validation cycle against their specification, plan, and repository conventions. Use when scoped product changes should be made and proven with fresh evidence.
---

# SDD Implement

Implement a requested or ready task against the accepted contract, then complete the review-validation cycle by default.

## Procedure

1. Identify the requested task or select and state one ready task. Do not begin blocked work.
2. Verify its dependencies and change its status to `in_progress`.
3. Load only the context it links to, following the stopping rule in `sdd/POLICIES.md`: relevant requirements and acceptance criteria, plan section, optional UI design, instructions, conventions, architecture, glossary terms, and ADRs.
4. Inspect implementation and tests at the responsible layer. Reuse established patterns before adding abstractions or dependencies.
   - Treat `local-assisted` output only as untrusted location/factual evidence. Validate its paths, ranges, and source hashes under `sdd/POLICIES.md`, then read every authority contract and every cited range that can affect an edit directly before changing code.
5. Make the smallest coherent change that satisfies the task outcome. Preserve unrelated behavior and user changes.
6. Add or update tests in proportion to risk, established project practice, and the task's validation contract. Test-first sequencing is optional unless locally required.
7. Run the focused checks named by the task. Apply the plan's change profile and `sdd/POLICIES.md`; broaden checks only when shared boundaries, risk, or repository policy warrants it, and separate new regressions from baseline failures.
   - When a check fails unexpectedly, gather evidence and identify the root cause before changing code; do not patch the nearest symptom by guesswork.
8. If evidence reveals a material deviation:
   - Do not silently improvise a new requirement.
   - Use `$sdd-change` for a changed contract.
   - Revisit `$sdd-plan` when the accepted technical approach is invalid.
9. Mark the task `completed` only after its validation passes. Recompute the ready frontier. Implementation completion does not imply feature validation.
10. Unless this is runner-owned mode, continue automatically with `$sdd-review` and `$sdd-validate`; do not wait for separate user invocations. Send actionable failures back through the smallest `$sdd-implement` repair, then repeat review and validation until they pass or a stopping condition in `sdd/POLICIES.md` is reached.

## Boundaries

- Do not expand into nearby cleanup or speculative infrastructure.
- Do not claim checks that were not run or hide failing output.
- Do not mark dependent tasks ready until every blocker is completed.
- Use direct context. Do not invoke Ollama or `local-assisted` unless the user explicitly requested it.

## Runner-owned mode

Use this mode only when the prompt contains both `SDD_RUNNER_MODE: true` and an
`SDD_RUNNER_PHASE` of `IMPLEMENT` or `REPAIR`.

- The runner owns every task status and the ready frontier. Do not edit status fields.
- In `IMPLEMENT`, implement only the supplied task from its linked artifacts and run focused checks.
- In `REPAIR`, address only the supplied review findings or validation delta. Do not broaden the task or claim validation passed.
- Use only local repository tools. Do not spawn agents, use apps/plugins/MCP/browser/computer tools, run hooks, or install dependencies.
- Return only the JSON object required by the runner's output schema: result, repository-relative modified paths, concise evidence, and a human decision when blocked.
- Report `BLOCKED` instead of choosing a materially new requirement or performing an unauthorized action.

## Report

After the full cycle, describe the outcome, files changed, task status, review result, validation evidence, deviations, remaining risks, and next ready tasks.
