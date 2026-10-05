---
name: sdd-validate
description: Validate a completed SDD change against acceptance criteria and the repository definition of done using fresh command evidence. Use after review or fixes to issue an honest PASS, FAIL, or PARTIAL result.
---

# SDD Validate

Prove the claims that matter. Validation is an evidence-gathering activity, separate from code review.

## Procedure

1. Define the validation target and fixed implementation state. Read the active specification, relevant task validations, review findings, and the applicable definition of done.
2. Read the plan's change profile and full-validation decision. Apply the validation and tool policies in `sdd/POLICIES.md`; discover real commands from manifests, repository documentation, CI configuration, and tool files.
3. Build an evidence map from every required acceptance criterion and unresolved review finding to one of:
   - An executable check.
   - A direct inspection with a reproducible observation.
   - A manual check whose method and result are recorded.
   - `NOT VERIFIED` with the exact limitation.
4. Run the smallest sufficient focused checks first. Run broader checks only when the plan, scope, risk, repository policy, or discovered blast radius requires them.
5. Read exit status and meaningful output. A command invocation without its result is not evidence.
   - Classify failures as introduced regression, unchanged baseline, or unknown provenance. Baseline debt remains out of scope unless it blocks relevant proof or the change worsens it.
6. Verify documentation, scope, and required review findings in addition to automated checks.
7. Assign the final result:
   - `PASS`: every required criterion and definition-of-done item is satisfied with current evidence, and no blocking finding remains.
   - `FAIL`: a required criterion fails, a required command fails, or a blocking finding remains.
   - `PARTIAL`: required evidence cannot be obtained or a criterion remains not verified.

## Boundaries

- Never reuse stale claims as if they were fresh results.
- Do not convert unavailable evidence into a pass.
- Distinguish `NOT REQUIRED` from `NOT RUN`.
- Do not fix defects unless the user separately requests implementation.

## Report

Provide:

1. Final `PASS`, `FAIL`, or `PARTIAL` verdict.
2. One row per acceptance criterion with status and evidence.
3. Commands with `PASS`, `FAIL`, `NOT REQUIRED`, or `NOT RUN` and concise output.
4. Definition-of-done status, remaining findings, limitations, and next action.
