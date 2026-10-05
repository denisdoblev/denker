# Project constitution

These stable principles govern the project. Keep technology choices and temporary implementation detail elsewhere.

## Required

1. Prefer the simplest solution that satisfies current requirements over speculative flexibility.
2. Use evidence rather than assumptions, and explicit requirements rather than guessed ones.
3. Reuse existing project patterns and platform capabilities before creating abstractions or adding dependencies.
4. Make architectural decisions intentionally; record an ADR only when a decision is durable, consequential, and involves a real trade-off.
5. Test in proportion to risk, impact, and failure cost. No universal development technique is mandatory without a project-specific reason.
6. Keep SDD depth proportional to uncertainty, blast radius, reversibility, migration impact, and user impact.
7. Document decisions and constraints, not a paraphrase of the code.
8. Prefer present requirements to hypothetical future needs.

## Recommended

- Keep boundaries explicit and dependencies directional.
- Make behavior verifiable through stable interfaces.
- Choose reversible approaches when options otherwise provide similar value.

## Optional

Add project-specific principles only when they are stable, discriminating, and verifiable. Put conventions and technology details in `conventions.md` instead.
