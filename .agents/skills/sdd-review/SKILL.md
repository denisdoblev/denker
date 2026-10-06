---
name: sdd-review
description: Review an SDD implementation independently for specification compliance, repository standards, and unnecessary complexity. Use after implementation to produce evidence-backed findings without conflating review with final validation.
---

# SDD Review

Review the implementation on three independent axes: **SPEC**, **STANDARDS**, and **SIMPLICITY**.

## Procedure

1. Read `references/review-criteria.md` before reviewing.
2. Establish the review target: requested files, working-tree diff, commit range, or other fixed point. State when the target is incomplete or moving.
3. Read the active specification, plan, optional UI design, task outcomes, and only the applicable project instructions and standards.
4. Inspect relevant code and tests. Use repository evidence rather than assuming a pattern or requirement.
5. Evaluate each axis separately:
   - **SPEC:** required behavior, acceptance coverage, edge cases, and prohibited scope.
   - **STANDARDS:** applicable instructions, architecture, conventions, safety, compatibility, and test quality.
   - **SIMPLICITY:** duplication, speculative abstractions, unnecessary dependencies, and avoidable surface area.
6. Report findings first, ordered by severity. Every finding must identify the location, evidence, violated requirement or standard, impact, and a concrete recommendation.
7. Then report axis results, unknowns, residual risks, and test gaps. Explicitly say when no material findings were found.

## Boundaries

- Do not modify code unless the user separately asks for fixes.
- Do not invent style rules or treat preferences as defects.
- Do not claim runtime correctness solely from reading code.
- Review may recommend validation, but it does not replace `$sdd-validate`.

## Runner-owned mode

Use this mode only when the prompt contains `SDD_RUNNER_MODE: true` and
`SDD_RUNNER_PHASE: REVIEW`.

- Treat the supplied paths and bounded runner-generated diff as the fixed review target, checking repository files only where evidence requires it.
- Use only local read-only repository tools. Do not modify files, spawn agents, use apps/plugins/MCP/browser/computer tools, run hooks, or install dependencies.
- Return only the JSON object required by the runner's output schema.
- Use only these semantic pairs: `PASS`/`NONE`, `FAIL`/`AUTO_FIX`, or `BLOCKED`/`HUMAN_DECISION`.
- Classify every finding as SPEC, STANDARDS, or SIMPLICITY and include the evidence, contract, impact, and smallest responsible recommendation required by `references/review-criteria.md`.
- Reserve `BLOCKED` for a decision the repair loop cannot make safely. A repairable defect is `FAIL`.

## Report

Use the format in the criteria reference. Distinguish confirmed defects from questions and risks.
