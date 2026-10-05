---
name: sdd-plan
description: Produce a proportional implementation plan from an accepted SDD specification and real repository evidence. Use when deciding how work will fit the existing architecture while excluding speculative complexity.
---

# SDD Plan

Translate the accepted contract into a credible technical approach without writing product code or decomposing it into execution tasks.

## Procedure

1. Read the active specification and applicable `AGENTS.md`. Apply the context and tool policies in `sdd/POLICIES.md`; load only relevant constitution rules, architecture, conventions, glossary entries, and ADRs.
2. Confirm that no unresolved question would materially change the approach. Return to `$sdd-clarify` rather than silently deciding product behavior.
3. Inspect the actual code paths, tests, interfaces, and established patterns likely to be affected.
4. Start from `sdd/templates/plan.md` and describe:
   - The justified change profile and whether full validation is required.
   - The approach and boundaries.
   - Affected components and interfaces.
   - Data, API, compatibility, migration, rollout, and rollback implications when applicable.
   - Testing strategy tied to acceptance risks and the validation policy in `sdd/POLICIES.md`.
   - Architectural impacts and whether a durable decision needs an ADR.
   - Explicit non-changes, risks, and mitigations.
5. Apply the simplicity gate to each proposed element:
   - Is it required by a requirement or acceptance criterion now?
   - Does an equivalent capability or pattern already exist in the repository?
   - Can the language, framework, platform, or an already-installed dependency solve it adequately?
   - What is the smallest implementation that satisfies current requirements?
   - Is a new boundary or generalization proven by real consumers?
   - Is it merely preparing for a hypothetical future?
6. Classify meaningful complexity as **required now**, **useful soon**, or **speculative**. Exclude speculative elements and explain significant exclusions.
7. Decide whether significant interface or experience work needs a UI artifact. Set `UI design required` and route to `$ui-design` when it does; do not require it for trivial presentation changes.

## Boundaries

- Prefer existing patterns and the smallest responsible layer.
- Create an ADR only for durable, consequential, cross-cutting decisions.
- Do not produce file-by-file microtasks; `$sdd-tasks` owns execution decomposition.

## Report

State the plan path, repository evidence used, complexity decisions, UI/ADR needs, risks, and any blocker.
