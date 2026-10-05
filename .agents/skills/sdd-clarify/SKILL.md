---
name: sdd-clarify
description: Resolve only the material ambiguities in an SDD specification before planning. Use when unanswered questions could change scope, acceptance criteria, user-visible behavior, compatibility, risk, or the implementation approach.
---

# SDD Clarify

Remove consequential uncertainty with the least interruption possible.

## Procedure

1. Read the active specification, request, applicable instructions, and only the repository evidence needed to answer its unresolved questions. Use the stopping rule in `sdd/POLICIES.md`.
2. Discard questions that are cosmetic, already answered, or safely deferred to implementation details.
3. Rank remaining questions by decision impact. Prioritize issues that could change scope, behavior, acceptance, compatibility, security, data handling, or plan shape.
4. Ask focused questions in small batches, preferably one decision at a time when later questions depend on the answer. Include relevant options and tradeoffs when evidence supports them.
5. After receiving an answer, update the specification directly:
   - Replace the unresolved item with the decision.
   - Adjust requirements, acceptance criteria, assumptions, and non-goals together.
   - Preserve traceable IDs unless their meaning changed; add new IDs rather than repurposing old ones.
6. Repeat only while material ambiguity remains. Mark the specification ready for planning when its acceptance contract is coherent.

## Boundaries

- Do not ask the user for information discoverable from the repository.
- Do not turn clarification into design, architecture, or task planning.
- Do not invent defaults for decisions with meaningful product consequences.
- If no material ambiguity exists, report that clarification is unnecessary and make no ceremonial edit.

## Report

List the decisions resolved, specification sections changed, assumptions retained, and any question that still blocks planning.
