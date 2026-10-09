# Chats guiados por fases de desarrollo — tasks

**Spec:** specs/002-guided-development-chats/spec.md
**Plan:** specs/002-guided-development-chats/plan.md
**UI design:** specs/002-guided-development-chats/ui.md

Status semantics:

- `ready`: incomplete, not active, without an external blocker, and every dependency is completed.
- `blocked`: an incomplete dependency or explicit external blocker exists.
- `in_progress`: actively being implemented.
- `completed`: expected outcome and task validation have current evidence.

The ready frontier is every task currently marked `ready`.

## Execution blockers

None. The active spec has no open questions, and the UI contract explicitly resolves the states that the plan required before task decomposition. This artifact does not change the recorded status of the spec, plan, or UI design.

## T1 — Crear el recorrido guiado independiente de cada PRD

**Status:** completed
**Depends on:** none
**External blocker:** none
**Requirements:** FR-001, FR-003, FR-008–FR-009, NFR-002; AC-001, AC-007–AC-008

**Expected outcome:**
Creating a Project or a later PRD produces exactly the six fixed guided Chats in their normative order, selects the available `PRD` Chat, and initializes the other phases as `Pendiente` and blocked. User-created Chats enter a separate additional group, remain immediately available, and neither participate in dependencies nor cross PRD or Project ownership boundaries. Continuing a final PRD as a new version preserves its one guided path and classifies the newly created empty Chat as additional.

**Relevant areas:**
Chat domain metadata and fixed factory, Project/PRD creation and continuation transitions, additional-Chat creation, store composition, navigation grouping and empty-state copy, domain and RTL fixtures.

**Validation:**
- Pure tests prove `createProject` and the `new-prd` continuation create exactly the six named guided Chats once, in order, with `PRD` selected and only that phase available initially.
- Tests prove `new-version` retains the existing guided Chats, progress and histories while its new empty Chat is additional rather than a second guided path.
- Domain and RTL flows prove additional Chats are visibly identified, selected on creation, always usable, and cannot unlock or mutate guided phases.
- Multi-PRD and multi-Project tests prove creation, selection, progress placeholders and Chat histories remain inside the owning branch.
- Repository inspection confirms the fixed tuple and metadata stay in `apps/web` without a configurable workflow, shared package, API, or new dependency.

**Notes:**
The task may introduce the full valid Chat shape needed by later tasks, but it does not add configurable phases or a second workflow per PRD version.

## T2 — Avanzar las fases sólo mediante lifecycle y progreso explícito

**Status:** completed
**Depends on:** T1
**External blocker:** none
**Requirements:** FR-002–FR-005, FR-007, FR-011, NFR-002; AC-002–AC-005, AC-010

**Expected outcome:**
The user can progress through the fixed guided path by changing only the PRD lifecycle and the explicit progress selector of an available post-PRD phase. One derived domain query supplies availability and actionable blockers to every consumer; `review` or `final` unlock both designs, the two designs jointly unlock the plan, and ready plan/implementation phases unlock their successors. Messages, documents and Demo Mode never infer or change progress.

**Relevant areas:**
Pure availability query and progress transition, lifecycle integration, store actions and sync metadata, guided-row metadata, active Chat header and selector, live announcements, Demo Mode fixtures and focused tests.

**Validation:**
- Parameterized domain tests cover every permitted progress value, reject `not-applicable` outside the two design phases, and reject progress changes on `PRD`, additional, or currently blocked Chats.
- Domain tests cover `draft`, `review`, and `final`; both design prerequisites; `ready` versus non-enabling progress; and the full unlock sequence through `Pruebas y revisión`.
- RTL tests prove the selector label and option sets, immediate availability updates, retained focus, accurate Spanish lifecycle/progress text and announcements, and the existing `unsynced` effect after a confirmed local change.
- Tests send messages, save documents, load and advance deterministic scenarios, and confirm none changes guided progress automatically.
- RTL assertions confirm there are no controls for adding, deleting, renaming, reordering, or configuring phases or dependencies.

**Notes:**
Availability and blockers are derived, not persisted. The UI consumes the domain result instead of reimplementing dependency rules.

## T3 — Explicar y contener bloqueos y retrocesos sin perder trabajo

**Status:** completed
**Depends on:** T2
**External blocker:** none
**Requirements:** FR-003–FR-007, FR-011–FR-012, NFR-003; AC-003–AC-006, AC-011

**Expected outcome:**
A blocked row remains keyboard-operable as a disclosure, keeps the current Chat selected, and explains every actionable prerequisite in flow order. If lifecycle or progress regresses, direct and transitive dependants block immediately without losing progress or history; an active affected Chat remains selected as a read-only surface until its prerequisites recover, and every mutation path rejects use while blocked.

**Relevant areas:**
Transitive blocker calculation and mutation guards, selection/messages/Demo Mode transitions, guided navigation rows and lock affordance, inline requirement disclosure, active read-only Chat surface, focus and live-region behavior, desktop and sheet navigation.

**Validation:**
- Pure tests advance through `Implementación`, regress each design and the PRD lifecycle independently, and prove the correct transitive phases block while progress, messages and additional Chats remain byte-for-byte unchanged; restoring prerequisites restores access.
- Domain tests prove stale selection cannot bypass guards for selecting another blocked phase, sending a message, changing progress, or loading/advancing Demo Mode.
- RTL tests exercise blocked rows with pointer, `Enter`, and `Space`; selection and open document remain unchanged, focus stays on the row, `aria-expanded`/`aria-controls` are correct, and the current actionable causes are announced.
- RTL tests prove an active re-blocked Chat retains `aria-current` and visible read-only history, exposes the persistent recovery alert and first actionable destination, and removes the progress selector, composer, and Demo Mode load/advance controls until access returns.
- Accessible-name assertions prove full phase name, progress, `Bloqueado`, and `Mostrar requisitos` remain perceivable without relying on the right-aligned lock icon or color.

**Notes:**
Do not navigate automatically when a Chat becomes blocked. Only one blocker disclosure remains open per PRD, as fixed by the UI contract.

## T4 — Recuperar el flujo completo desde un envelope local `v2`

**Status:** completed
**Depends on:** T2
**External blocker:** none
**Requirements:** FR-009–FR-010, NFR-001; AC-008–AC-009

**Expected outcome:**
The full guided/additional Chat shape, histories, progress and active selection round-trip through a strict `v2` workspace envelope under the existing storage key. Reload restores the same independently owned flows and derived availability without network access. Existing `v1` bytes follow the current invalid-data recovery path unchanged until a confirmed reset, and unavailable browser storage still degrades to the in-memory session.

**Relevant areas:**
Workspace envelope types and decoder, persistence port and browser/memory adapters, store hydration and reset flow, explicit test constructors, simulated-reload RTL coverage.

**Validation:**
- Focused decoder tests accept representative valid `v2` workspaces and reject missing, unknown, or invalid Chat class/phase/progress combinations.
- Round-trip tests preserve guided and additional identities, lifecycle, progress, histories and selection while recomputing availability rather than storing it.
- Persistence tests prove the key is unchanged, a `v1` payload is reported invalid without byte changes or writes before confirmed reset, and storage exceptions retain a usable in-memory session.
- A simulated reload after creating additional Chats, advancing phases and adding messages restores the exact active branch and visible workflow; isolation assertions cover another PRD and another Project.
- The reload flow runs with unexpected network access rejected and components continue to access storage only through the persistence/store boundary.

**Notes:**
No automatic `v1 → v2` conversion, migration framework, IndexedDB, backend, or remote persistence is introduced.

## T5 — Probar el contrato completo y documentar el estado implementado

**Status:** completed
**Depends on:** T3, T4
**External blocker:** none
**Requirements:** FR-001–FR-012, NFR-001–NFR-003; AC-001–AC-011; Definition of Done

**Expected outcome:**
Current evidence demonstrates the entire guided-development flow without relying on stale or unrelated results. The navigation, progress control, blocker disclosure and active read-only state work at the three supported layouts and by keyboard; repository-wide gates pass; and technical documentation records the actually implemented fixed flow and `v2` persistence boundary without anticipating backend, AI, GitHub, collaboration, or workflow infrastructure.

**Relevant areas:**
Acceptance traceability and regression tests, responsive and accessibility smoke evidence, root validation gates, `docs/architecture.md` and any convention that the implementation actually establishes.

**Validation:**
- A current traceability map points AC-001–AC-011 to passing pure or RTL tests, including lifecycle/continuation, documents, Demo Mode, sync and existing MVP regression coverage affected by the expanded Chat type.
- From the repository root, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass with their discovered definitions.
- Stable Chrome smoke checks at 1440 px, 768 px, and 390 px cover guided/additional grouping, the right-aligned lock, wrapped explanations, progress changes, re-blocking, focus restoration and sheet behavior.
- A keyboard-only pass covers navigation, blocked disclosures, progress selection, recovery from an active blocked Chat and additional-Chat creation; visible focus, 24 × 24 CSS px targets and WCAG 2.2 AA contrast are checked on normal, selected and muted backgrounds.
- Documentation review confirms `docs/architecture.md` describes the six-Chat creation flow, derived availability, mutation guards and envelope `v2`, and distinguishes implemented state from future integrations.
- Scope review confirms no configurable workflow, schema library, migration framework, new UI dependency, route, package, network service or unrelated behavior entered the change.

## Dependency graph

```text
T1 ── T2 ──┬── T3 ──┐
            └── T4 ──┴── T5
```

After T2 completes, T3 and T4 are independently executable. T5 requires both behavior and persistence evidence.

## Acceptance coverage

| Acceptance criteria | Primary task coverage | Current automated evidence |
| --- | --- | --- |
| AC-001 | T1 | `workspace.test.ts`: `creates the owned initial branch…`, `continues a final PRD…`; `workspace-shell.test.tsx`: `crea sólo con nombre…` |
| AC-002 | T2 | `workspace.test.ts`: permitted/rejected guided progress; `demo-scenarios.test.ts`: `never infers guided progress…`; `workspace-shell.test.tsx`: `permite avanzar fases…` |
| AC-003–AC-005 | T2, T3 | `workspace.test.ts`: full unlock sequence and lifecycle cases; `workspace-shell.test.tsx`: explicit progress and unlock announcement |
| AC-006 | T3 | `workspace-shell.test.tsx`: `explica bloqueos por teclado…` |
| AC-007–AC-008 | T1 | `workspace.test.ts`: owned Chat creation; `workspace-shell.test.tsx`: branch/history isolation and reload isolation |
| AC-009 | T4 | envelope and persistence suites; `workspace-shell.test.tsx`: guided-flow reload without network |
| AC-010 | T2 | `workspace-shell.test.tsx`: absence of workflow-configuration controls; scope inspection |
| AC-011 | T3 | `workspace.test.ts`: transitive blocking/restoration; `workspace-shell.test.tsx`: active re-blocked read-only Chat |
