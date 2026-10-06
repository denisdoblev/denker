# [Feature title] — tasks

**Spec:** [path or ID]
**Plan:** [path]

Status semantics:

- `ready`: incomplete, not active, without an external blocker, and every dependency is completed.
- `blocked`: an incomplete dependency or explicit external blocker exists.
- `in_progress`: actively being implemented.
- `completed`: expected outcome and task validation have current evidence.

The ready frontier is every task currently marked `ready`.

## T1 — [Outcome-oriented title]

**Status:** ready
**Depends on:** none
**External blocker:** none
**Requirements:** FR-001, AC-001

**Expected outcome:**
[A demonstrable or verifiable behavior, preferably a narrow vertical slice.]

**Relevant areas:**
[Likely modules or surfaces; avoid a file-by-file procedure unless essential.]

**Validation:**
[Checks that prove this task's outcome.]

**Notes:**
[Only task-specific constraints or decisions.]

## T2 — [Outcome-oriented title]

**Status:** blocked
**Depends on:** T1
**External blocker:** none
**Requirements:** [IDs]

**Expected outcome:**
[Outcome.]

**Validation:**
[Evidence.]
