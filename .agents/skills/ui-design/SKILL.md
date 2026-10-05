---
name: ui-design
description: Design or review significant user interfaces within an SDD feature using repository and product context. Use when hierarchy, interaction, responsive behavior, states, accessibility, or visual direction need an explicit UI artifact before implementation.
---

# UI Design

Produce an implementation-ready UI contract grounded in the existing product. This skill designs and reviews; it does not write frontend code.

## Design procedure

1. Read the active specification and plan, applicable instructions, and relevant product documentation.
2. Inspect the existing interface before proposing change:
   - Design system, components, tokens, typography, spacing, icons, and interaction patterns.
   - Nearby screens and flows.
   - Framework and platform constraints.
   - Existing accessibility and responsive conventions.
3. Establish only supported context: who uses the surface, user goal, primary and secondary actions, information hierarchy, domain vocabulary, related surfaces, devices, content constraints, and success or failure states. Do not invent personas, metrics, or brand attributes.
4. Define the experience in this order:
   - Content and hierarchy.
   - User flow and interaction behavior.
   - Relevant loading, empty, error, success, disabled, permission, destructive, partial or missing-data, and long-content states.
   - Responsive behavior as intentional representations, not only smaller dimensions.
   - Keyboard, focus, semantics, labels, contrast intent, motion, and assistive-technology considerations where applicable. Do not claim conformance without evidence.
   - Visual direction, density, typography, color roles, and motion after structure is sound.
5. Prefer existing components and tokens. Introduce a new pattern only for a demonstrated need and explain why reuse is insufficient.
6. Write `specs/<feature>/ui.md` or the repository's established equivalent. Use a proportional subset of: purpose, user goal, primary and secondary actions, information hierarchy, layout, components, interactions, states, responsive behavior, accessibility considerations, existing elements to reuse, genuinely new patterns, and open questions. Link decisions to requirements and acceptance criteria without duplicating the spec or plan.
7. Apply the simplicity test: remove decorative, duplicated, or generic interface elements that do not improve hierarchy, comprehension, feedback, or action.

## Review procedure

When reviewing an implementation or existing design, read `references/design-review.md`, inspect the rendered evidence available, and compare it with the UI artifact, specification, design system, and product context. Report findings without changing code unless asked.

## Boundaries

- Do not implement frontend code or introduce a UI framework.
- Do not force a fixed visual style; derive direction from product intent and established language.
- Do not create a UI artifact for trivial copy, spacing, or token-only changes unless risk justifies it.
- Avoid generic dashboard composition, arbitrary gradients or shadows, excessive cards or rounding, oversized hero areas, wasteful whitespace, and ornamental motion without a product reason.

## Report

State the artifact path, existing system reused, hierarchy and flow, state coverage, responsive and accessibility decisions, new patterns, deliberate omissions, and unresolved constraints.
