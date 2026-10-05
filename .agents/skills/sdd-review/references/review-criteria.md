# SDD review criteria

Use only criteria that apply to the reviewed scope. A longer checklist is not a stronger review.

## Severity

- **Critical:** causes data loss, severe security exposure, broad outage, or makes the feature fundamentally unusable.
- **High:** violates a core requirement or boundary, produces incorrect behavior in a likely path, or creates a serious compatibility or reliability risk.
- **Medium:** breaks an edge case, weakens maintainability at a real boundary, or leaves meaningful evidence incomplete.
- **Low:** localized issue with limited impact and a clear, proportionate correction.

Do not assign severity to taste, hypothetical future needs, or unsupported concerns.

## SPEC axis

- Each implemented behavior maps to a requirement and acceptance criterion.
- Required success, failure, empty, boundary, and compatibility cases are handled where relevant.
- Observable behavior matches the specification rather than only the plan.
- Explicit non-goals and out-of-scope boundaries remain intact.
- Tests provide credible evidence for the acceptance contract.

## STANDARDS axis

- Applicable `AGENTS.md`, constitution, architecture, conventions, and ADR rules are followed.
- The change lives at the responsible layer and respects ownership boundaries.
- Public interfaces, stored data, errors, logging, security, accessibility, and migrations are handled when relevant.
- Tests follow repository practice and exercise risks rather than implementation trivia.
- Documentation changes match user-visible or operator-visible behavior.

## SIMPLICITY axis

- Existing platform, repository utilities, components, and installed dependencies are reused when appropriate.
- New abstractions have a present, evidenced responsibility.
- No duplicate representation, premature generalization, unnecessary configuration, or avoidable dependency was introduced.
- The change can be reduced without losing required behavior, safety, clarity, or maintainability.
- Naming and control flow expose the domain intent without decorative indirection.

## Finding format

`[severity] [axis] short title — path:line`

- **Evidence:** what the implementation demonstrably does.
- **Contract:** the requirement, acceptance criterion, or repository rule involved.
- **Impact:** the user, system, or maintenance consequence.
- **Recommendation:** the smallest responsible correction.

## No-finding summary

When there are no material findings, state that explicitly, then list:

- Review target and axes evaluated.
- Evidence inspected.
- Checks observed or run.
- Unknowns, residual risks, and unverified behavior.
