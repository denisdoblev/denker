# Project guidance

## Context router

- `docs/constitution.md`: stable project principles; consult for substantive or disputed decisions.
- `docs/architecture.md`: current components and boundaries; consult when changing modules, dependency direction, infrastructure, integrations, or cross-component flows.
- `docs/conventions.md`: implementation conventions; consult the global file and the nearest scoped file for the area being changed.
- `docs/glossary.md`: optional domain vocabulary; consult only when domain terms affect the work.
- `docs/adr/`: durable decisions; inspect relevant ADRs when a prior choice may constrain the change.
- `specs/<feature>/`: active spec, plan, UI design, and tasks; consult the artifacts relevant to the current feature and stage.
- `sdd/POLICIES.md`: canonical context, tool, validation, and memory rules; consult only the relevant section.

Nearest scoped documentation supplements or overrides global guidance unless it conflicts with the constitution. Do not read every document for every change.

## Working principles

- Evidence over assumptions; explicit requirements over guessed requirements.
- Reuse existing patterns before adding abstractions, dependencies, or infrastructure.
- Specs define what and why. Plans define how. Tasks define executable outcomes.
- Keep changes within scope. Surface material deviations instead of improvising silently.
- Use SDD in proportion to risk: trivial changes may be handled directly; standard and high-risk work need progressively stronger artifacts and evidence.
- Stop gathering context when evidence is sufficient; select tools and validation through `sdd/POLICIES.md`.

## Definition of Done

When applicable:

- Spec requirements and acceptance criteria are satisfied.
- Relevant tests and behavioral checks have fresh passing results.
- The project's actual typecheck, lint, and build checks pass when required.
- Documentation reflects changed behavior, architecture, conventions, or durable decisions.
- No unjustified out-of-scope change or unresolved critical review finding remains.
- Completion is reported only with current evidence.

Discover verification commands from the repository; do not assume a package manager or toolchain.
