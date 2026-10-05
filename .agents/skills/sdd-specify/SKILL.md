---
name: sdd-specify
description: Turn a feature, bug, or change request into a testable SDD specification focused on what and why. Use when requirements need to be captured without inventing missing product decisions or prescribing implementation.
---

# SDD Specify

Write a precise contract for the requested outcome. Keep implementation choices out of the specification unless they are themselves explicit constraints.

## Procedure

1. Locate the applicable instructions and active feature directory. Use `specs/<NNN-short-name>/spec.md` unless the repository has an established equivalent.
2. Read only the context needed: applicable `AGENTS.md`, the constitution, relevant glossary terms, the request, and closely related specifications.
3. Separate evidence into:
   - Confirmed facts from the request or repository.
   - Reasonable inferences, labeled as assumptions.
   - Material gaps, recorded as unresolved questions.
4. Start from `sdd/templates/spec.md` and keep only relevant sections.
5. Define:
   - The problem, affected actors or systems, goals, and explicit non-goals.
   - Functional requirements with stable IDs such as `FR-001`.
   - Non-functional constraints only when supported by evidence.
   - Observable acceptance criteria with IDs such as `AC-001`, mapped to requirements.
   - Important edge cases, dependencies, assumptions, and out-of-scope behavior.
6. Check that every goal is represented by requirements and every requirement is verifiable through acceptance criteria.
7. If a material ambiguity remains, mark the specification accordingly and recommend `$sdd-clarify`. Do not fill the gap with a plausible invention.

## Boundaries

- Specify **what** must be true and **why** it matters.
- Do not select architecture, libraries, schemas, file layouts, or task decomposition here.
- Scale the artifact to the work. A small change needs a short, testable specification, not empty ceremony.

## Report

State the specification path, status, important assumptions, unresolved questions, and requirement-to-acceptance coverage.
