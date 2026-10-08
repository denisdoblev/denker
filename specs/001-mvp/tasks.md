# MVP frontend local de Denker — tasks

**Spec:** specs/001-mvp/spec.md
**Plan:** specs/001-mvp/plan.md
**UI design:** specs/001-mvp/ui.md

Status semantics:

- `ready`: incomplete, not active, without an external blocker, and every dependency is completed.
- `blocked`: an incomplete dependency or explicit external blocker exists.
- `in_progress`: actively being implemented.
- `completed`: expected outcome and task validation have current evidence.

The ready frontier is every task currently marked `ready`.

## Execution blockers

None. Tasks can still be blocked by incomplete implementation dependencies.

Resolved product decision: all user-facing interface copy is in Spanish; no i18n infrastructure is introduced for the MVP.

## T1 — Deliver a reproducible local web shell

**Status:** completed
**Depends on:** none
**External blocker:** none
**Requirements:** NFR-001; AC-020

**Expected outcome:**
The repository has the minimal `pnpm`/Turborepo setup and one `apps/web` Next.js TypeScript workspace. It exposes real root commands for development, typecheck, lint, Jest/React Testing Library tests, and build; includes the shadcn/ui base needed by the approved UI; and renders a neutral client hydration shell without requiring a backend, secrets, or network access at runtime.

**Relevant areas:**
Root workspace and Turborepo configuration, `apps/web`, App Router shell, styling and shadcn/ui primitives, Jest/RTL setup.

**Validation:**
- A clean install from the committed lockfile succeeds.
- The discovered root `typecheck`, `lint`, `test`, and `build` commands pass.
- The production build completes without secrets or remote services and the app renders `Loading local workspace` before browser state resolves.
- Repository inspection confirms one product workspace and no speculative shared package.

**Notes:**
Blocked on explicit acceptance of the draft plan and UI design. Pin actual tool versions in `packageManager` and the lockfile rather than copying assumptions from documentation.

## T2 — Hydrate and preserve a recoverable local workspace

**Status:** completed
**Depends on:** T1
**External blocker:** none
**Requirements:** FR-021, FR-026, NFR-003; AC-016, AC-023

**Expected outcome:**
A typed domain state and replaceable persistence port load and save a versioned `v1` envelope outside presentation components. Hydration distinguishes absent, valid, invalid, and unavailable storage; unavailable storage falls back to session memory, while invalid data remains untouched until a confirmed reset. Persisted active selection is restored or resolved deterministically to an existing Chat.

**Relevant areas:**
Domain types and transitions, React store composition, persistence port, browser and memory adapters, envelope decoder, hydration and invalid-data recovery UI.

**Validation:**
- Focused pure tests cover the envelope decoder, valid round trips, invalid/unknown payloads, deterministic selection recovery, and storage exceptions.
- RTL tests prove hydration has no premature fixture flash, changes survive a simulated reload, and presentation components do not require direct `localStorage` access.
- RTL tests prove storage failure still permits an in-memory session and invalid bytes are unchanged after detection and cancellation.
- Reset confirmation starts an empty workspace only after the destructive action is confirmed, with initial focus on `Cancel`.

**Notes:**
Do not add migrations for nonexistent earlier schemas, IndexedDB, cross-tab synchronization, or automatic deletion of invalid data.

## T3 — Create and navigate correctly owned Projects, PRDs, and Chats

**Status:** completed
**Depends on:** T2
**External blocker:** none
**Requirements:** FR-001–FR-008, NFR-002, NFR-005; AC-001–AC-005, AC-022

**Expected outcome:**
From an empty workspace, the user creates a Project with only a name and lands in its empty first Chat with an initial Product Context and `PRD 001` draft containing explicit `TBD`s. The navigation preserves `Project → PRD → Chat` ownership across multiple branches and independent Chat histories. Repository configuration remains optional, uses `main` and `/docs` defaults, is editable later, and is clearly identified as a local demo without credentials or remote operations.

**Relevant areas:**
Creation and repository dialogs, ownership transitions and selectors, sidebar navigation, empty Chat/composer state, active selection, repository summary.

**Validation:**
- RTL flows cover creation from empty state, focus transfer to the composer, initial documents, invitation text, and active Chat selection.
- Multi-Project and multi-Chat tests prove branch isolation, correct `aria-current`, independent histories, and access to the shared PRD/Product Context.
- Tests cover creation without a repository and later configuration, plus default materialization for omitted branch/path.
- The exercised flow succeeds with network access failed and exposes no authentication, role, permission, credential, OAuth, or remote-connect controls.

**Notes:**
All user-facing copy is in Spanish. Do not add rename, archive, duplicate, or delete actions.

## T4 — Run deterministic Demo Mode conversations and recoverable scenarios

**Status:** completed
**Depends on:** T3
**External blocker:** none
**Requirements:** FR-009, FR-010, FR-025, NFR-002; AC-006, AC-007, AC-019

**Expected outcome:**
Demo Mode exposes the complete approved scenario catalog, clearly says messages are not interpreted, and advances a fixed script only for nonblank messages. Loading the same scenario from the same starting state is repeatable, explicit confirmation protects confirmed state, and each error scenario identifies the failure and provides its defined recovery without losing saved content.

**Relevant areas:**
Declarative fixtures, deterministic scenario transitions, Demo Mode controls, Chat log and composer, load confirmation, error alerts and recoveries.

**Validation:**
- Parameterized tests prove every required scenario loads and is repeatable.
- Two different nonblank messages at the same step produce the same transition; blank/whitespace input does not advance; Enter and Shift+Enter follow the UI contract.
- Loading a scenario that would replace confirmed state requires the specified confirmation and cancellation preserves state.
- Parameterized error tests prove each approved error and recovery returns to a usable state without changing the last confirmed document.
- Tests fail unexpected network access and confirm no interpretation, thinking state, or remote dependency is introduced.

**Notes:**
The accepted error catalog contains `Respuesta de demostración interrumpida` with `Reintentar respuesta`, and `Escenario no disponible` with `Volver al Chat`. Fixture display names and final copy are in Spanish.

## T5 — Keep Markdown editing under explicit user control

**Status:** completed
**Depends on:** T3
**External blocker:** none
**Requirements:** FR-011–FR-013, FR-019, FR-020; AC-008, AC-009, AC-014, AC-015

**Expected outcome:**
From a Chat, the user opens the related document surface and switches among the current PRD, Product Context, and final snapshots. Editable documents support Preview, Edit, Save, Discard, and exact-source Copy; preview reflects the unsaved draft, saved/accepted Markdown remains authoritative, and a shared guard prevents silent loss when closing or navigating. Final snapshots expose read-only preview and copy only.

**Relevant areas:**
Document selector and surface, safe Markdown renderer, editor draft state, preview/edit controls, Clipboard adapter and feedback, unsaved-change guard and pending navigation.

**Validation:**
- RTL tests render flexible Markdown containing `TBD`, warnings, questions, omitted sections, unsafe HTML, long URLs, code, and tables without requiring a fixed template or enabling raw HTML.
- Edit/Preview/Save/Discard tests distinguish draft from saved source and prove saved or accepted content is not overwritten by navigation, reload, or fixture application.
- Closing or changing document, Chat, PRD, Project, or scenario with a draft exercises one shared confirmation; cancellation retains selection, draft, and focus.
- Clipboard success copies the complete current source, including a draft; rejection shows nonblocking feedback, preserves editing, and offers no fallback mechanism.
- Snapshot tests prove no effective edit, save, or discard control exists.

**Notes:**
The editor draft, overlay visibility, and transient Clipboard errors stay outside the persisted envelope.

## T6 — Resolve sensitive proposals without premature document mutation

**Status:** completed
**Depends on:** T4, T5
**External blocker:** none
**Requirements:** FR-014; AC-010

**Expected outcome:**
Every exhaustive sensitive-change category appears as a pending approval tied to its target document. The current document stays unchanged until the user accepts; acceptance applies exactly the proposal and persists the decision, while rejection preserves the previous document. Ordinary scripted changes remain possible without approval.

**Relevant areas:**
Proposal fixtures and domain transitions, `Pending approval` composition in Chat history, document authority and persistence, accessible resolution feedback.

**Validation:**
- Parameterized tests cover requirement removal, consolidated-decision modification, material scope change, Product Context alteration, and potentially destructive change.
- For each category, tests prove the pending state leaves source unchanged, accept applies exactly once, reject leaves it unchanged, and the persisted history shows `Accepted` or `Rejected` without active controls.
- A representative ordinary change applies without the sensitive approval flow.
- Focus and polite announcement behavior are verified for both resolutions.

## T7 — Complete review, immutable finalization, and explicit continuation

**Status:** completed
**Depends on:** T4, T5
**External blocker:** none
**Requirements:** FR-015–FR-018; AC-011, AC-012, AC-013

**Expected outcome:**
The current PRD exposes only actions compatible with `draft`, `review`, or `final`. Review shows fixture findings and permits correction or return to draft. Finalization requires explicit acceptance of remaining warnings and creates an immutable snapshot. Continuing from Final creates either a new version of the same PRD or a different PRD only after the user's explicit choice and confirmation.

**Relevant areas:**
Lifecycle transitions and controls, review findings, finalization dialog, immutable snapshots, continuation decision and creation flows.

**Validation:**
- RTL tests prove allowed controls and displayed state for draft, review, and final, including editing during review and return to draft.
- Finalization without warnings and with warnings is covered; the latter cannot confirm before acceptance, while cancellation preserves review state.
- Snapshot tests attempt edits and scenario mutations and prove content remains unchanged, including after a later editable version exists.
- Continuation tests prove recommendations create nothing by themselves and each explicit choice creates the correctly owned entity only after confirmation.

**Notes:**
The accepted continuation rules preserve the PRD name and copy its final snapshot for the next numbered version; a different initiative receives the next three-digit PRD number, the initial `TBD` template, and its first empty Chat. Both retain the shared Product Context and require explicit confirmation.

## T8 — Separate local saves from deterministic demo synchronization

**Status:** completed
**Depends on:** T3, T5
**External blocker:** none
**Requirements:** FR-022, FR-023; AC-017

**Expected outcome:**
Saving confirmed local content can mark configured repository state as `Unsynced changes` without affecting data availability. `Sync now` deterministically transitions through `Syncing` to the scenario's `Synced` or `Sync failed` result; failure preserves confirmed local data and permits the prescribed retry, with no remote operation.

**Relevant areas:**
Repository summary, sync metadata transitions, deterministic scheduler boundary, status controls and announcements.

**Validation:**
- RTL tests distinguish `Saved locally` from every demo sync state and prove sync is unavailable without repository configuration.
- Fake-timer tests cover `Unsynced changes → Syncing → Synced` and `Unsynced changes → Syncing → Sync failed`, disabled actions while syncing, and deterministic retry.
- State assertions prove neither success nor failure mutates confirmed documents.
- Network calls are failed or spied on and remain absent throughout all sync transitions.

## T9 — Make the complete workspace responsive and keyboard accessible

**Status:** completed
**Depends on:** T4, T5, T6, T7, T8
**External blocker:** none
**Requirements:** FR-024, NFR-006; AC-018, AC-024

**Expected outcome:**
The completed workspace presents simultaneous navigation, Chat, and optional documents at 1440 px; collapsible/overlay navigation and modal documents at 768 px; and mutually exclusive full-height navigation/document sheets around a persistent Chat at 390 px. All critical flows work by keyboard with visible focus, accessible names, correct modal focus behavior, textual states, sufficient contrast, and reduced motion.

**Relevant areas:**
Responsive shell and surfaces, long-content behavior, shadcn/ui primitive composition, focus management, live regions, visual tokens and reduced-motion styles.

**Validation:**
- Focused RTL tests cover breakpoint-dependent controls, mutually exclusive overlays, draft guards on close/Escape, roles and names, `aria-expanded`/`aria-current`, focus trap and restoration, and polite/error announcements.
- Recorded manual checks at 1440, 768, and 390 px prove the UI contract, long-content wrapping, independent scrolling, usable composer, and document actions.
- A keyboard-only pass completes all critical flows and records focus order and visible focus.
- Contrast checks cover text, controls, status semantics, focus indicators, and interaction boundaries against WCAG 2.2 AA.
- A smoke pass in the current stable Chrome covers the critical flows; older Chrome versions and other browsers are outside the MVP compatibility contract.

**Notes:**
Final copy and accessible names must be in Spanish.

## T10 — Prove the MVP contract and record the implemented architecture

**Status:** completed
**Depends on:** T2, T3, T4, T5, T6, T7, T8, T9
**External blocker:** none
**Requirements:** NFR-001–NFR-006; AC-020, AC-021, AC-022, AC-024; Definition of Done

**Expected outcome:**
Current evidence demonstrates every acceptance criterion without relying on stale or unrelated results. The final suite maps AC-001–AC-019 and AC-023 to observable Jest/RTL coverage, all flows operate without external services or identity, repository-wide gates pass, Chrome/viewports evidence is recorded, and architecture/conventions describe the actually implemented topology, boundaries, and commands.

**Relevant areas:**
Acceptance traceability, test suite and fixtures, offline/no-identity checks, root validation commands, Chrome smoke evidence, `docs/architecture.md`, `docs/conventions.md`.

**Validation:**
- A traceability matrix points AC-001–AC-019 and AC-023 to current Jest/RTL tests and records their passing results; AC-020, AC-022, and AC-024 link to their task-specific evidence.
- The full test suite runs with unexpected network access rejected and confirms no login, role, or permission controls.
- Clean install plus root `typecheck`, `lint`, `test`, and `build` pass using the commands discovered from repository configuration.
- Current Chrome and viewport evidence from T9 is accepted; older Chrome versions and other browsers are explicitly outside AC-024.
- Documentation review confirms implemented facts are distinguished from future limits and no ADR, package, integration, deployment, or migration framework was added without new evidence.

## Dependency graph

```text
T1
└── T2
    └── T3
        ├── T4 ──┬── T6 ──┐
        │         └── T7 ──┤
        └── T5 ──┬── T6   ├── T9 ── T10
                  ├── T7   │
                  └── T8 ──┘
```

T8 depends on both T3 and T5. T10 also depends directly on T2–T8 so its completion contract cannot be satisfied by responsive work alone.

## Acceptance coverage

| Acceptance criteria | Primary task coverage |
| --- | --- |
| AC-001–AC-005 | T3 |
| AC-006–AC-007 | T4 |
| AC-008–AC-009 | T5 |
| AC-010 | T6 |
| AC-011–AC-013 | T7 |
| AC-014–AC-015 | T5 |
| AC-016 | T2 |
| AC-017 | T8 |
| AC-018 | T9 |
| AC-019 | T4 |
| AC-020 | T1, T10 |
| AC-021 | T3–T10, consolidated by T10 |
| AC-022 | T3, T4, T10 |
| AC-023 | T2 |
| AC-024 | T9, T10 |
