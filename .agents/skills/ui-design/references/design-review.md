# UI design review

Review only dimensions relevant to the feature and available evidence. A source inspection cannot prove visual behavior that requires a rendered interface.

## Product and hierarchy

- The primary user goal and action are apparent.
- Content order, grouping, density, and emphasis reflect actual task priority.
- Domain language is consistent with the product and specification.
- Secondary actions and decoration do not compete with the core flow.

## Interaction and states

- The path from entry to completion is coherent and reversible where needed.
- Feedback is timely and placed near the action or affected content.
- Relevant loading, empty, error, success, disabled, permission, validation, destructive, and long-content states are designed.
- Risky actions have proportionate prevention or recovery.

## System consistency and reuse

- Existing components, tokens, navigation, iconography, and interaction patterns are reused appropriately.
- A new pattern solves a demonstrated gap and fits the broader system.
- Similar concepts have similar names, behaviors, and representations.

## Responsive behavior

- Information priority survives across supported sizes and input modes.
- Layout changes are intentional; controls remain usable without relying on accidental wrapping.
- Dense data, navigation, overlays, and long text have explicit small-screen behavior when relevant.

## Accessibility considerations

- Structure and semantics convey relationships independently of visual styling.
- Keyboard order, focus visibility and restoration, labels, errors, and status announcements are considered.
- Color is not the sole carrier of meaning; contrast and target size risks are identified.
- Motion has purpose and a reduced-motion strategy when relevant.

Do not claim standards conformance unless appropriate checks and evidence support it.

## Visual coherence

- Typography, spacing, color roles, elevation, borders, imagery, and motion form an intentional hierarchy.
- Visual choices match the product context rather than a generic aesthetic trend.
- Noise, repetitive containers, arbitrary gradients, and ornamental effects are absent unless justified.

## Simplicity and evidence

- Every new element or pattern supports comprehension, action, feedback, safety, or product identity.
- The design avoids speculative states and controls unrelated to current requirements.
- Findings distinguish observed problems, inferred risks, and evidence unavailable for review.

## Finding format

`[severity] short title — surface or artifact location`

- **Evidence:** observed design or implementation behavior.
- **Contract:** relevant requirement, UI decision, design-system rule, or user goal.
- **Impact:** consequence for comprehension, completion, consistency, responsiveness, or accessibility.
- **Recommendation:** smallest coherent design correction.
