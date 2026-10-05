# Upstream research ledger

Research performed against official upstream repositories on 2026-10-01 and extended with the tool-policy sources listed below on 2026-10-02. This framework synthesizes principles and workflows in original wording; it does not vendor or substantially copy upstream Skills. Relevant repositories were checked under their published licenses; linked material is attribution and decision evidence, not vendored text.

`openai/skills` is now deprecated. Entries below identify historical material that was inspected; current OpenAI Skill behavior is verified against `openai/codex`, the OpenAI Plugins documentation and repository, and the Agent Skills specification.

## Conflict resolution applied

- Current Codex and Agent Skills structure takes precedence over host-specific upstream conventions.
- Proportional process and risk-based testing take precedence over universal TDD, fixed ceremonies, and mandatory approval gates.
- Persistent traceability is retained without importing trackers, databases, worktrees, commits, or multi-agent orchestration.
- Simplicity removes speculative work, but does not remove evidence needed to establish correctness.

## Shared Skill format

Sources inspected:

- `openai/codex`: `codex-rs/skills/src/assets/samples/skill-creator/SKILL.md`, `references/openai_yaml.md`, and `agents/openai.yaml`.
- `openai/skills` (historical, deprecated): `skills/.system/skill-creator/SKILL.md`.
- `agentskills/agentskills`: `README.md`, the current Agent Skills specification, and `docs/client-implementation/adding-skills-support.mdx`.

Adapted:

- Required `SKILL.md` with `name` and discriminating `description` frontmatter.
- Project discovery through `.agents/skills/`.
- Three-stage progressive disclosure: metadata, Skill body, conditional resources.
- Codex UI metadata in `agents/openai.yaml` and explicit invocation through `$skill-name`.
- `policy.allow_implicit_invocation: false` because this framework explicitly requests opt-in workflows.

Rejected:

- Unsupported or host-specific frontmatter keys.
- References, scripts, assets, icons, and dependencies without a concrete consumer.

## `sdd-init`

Sources inspected:

- `mouredev/hello-sdd`: `README.md`, `samples/AGENTS.md`, `habits-cli/README.md`, `habits-cli/AGENTS.md`, and `habits-cli/docs/constitution.md`.
- Shared Skill-format sources listed above.

Adapted:

- Persistent constitution, agent context, feature specs, and staged artifacts.
- Inspect-before-write initialization and repository-specific commands.
- Safe adaptation for existing repositories.

Rejected:

- A requirement to read every document before every change.
- Claude/OpenCode compatibility files and unconditional generated artifacts.

## `sdd-specify`

Sources inspected:

- `mouredev/hello-sdd`: `samples/spec.md`, `samples/prompts.md`, `habits-cli/specs/001-habits-mvp/spec.md`, and `habits-cli/.claude/skills/spec-generator/SKILL.md`.
- `obra/superpowers`: `skills/brainstorming/SKILL.md`.
- `mattpocock/skills`: `skills/engineering/to-spec/SKILL.md` and `docs/engineering/to-spec.md`.

Adapted:

- WHAT/WHY separation, explicit exclusions, traceable requirements, verifiable criteria, and assumptions.
- Ground intent in the repository and separate stated facts from inference.
- Specs preserve decisions and use project domain language.

Rejected:

- Mandatory interviews, approval gates, tracker publication, fixed-length user-story catalogs, and implementation decisions inside every spec.

## `sdd-clarify`

Sources inspected:

- `mouredev/hello-sdd`: `samples/prompts.md` and clarification section of `habits-cli/README.md`.
- `obra/superpowers`: `skills/brainstorming/SKILL.md`.
- `mattpocock/skills`: `skills/engineering/to-spec/SKILL.md` and `skills/engineering/domain-modeling/SKILL.md`.

Adapted:

- Find contradictions, ambiguity, missing edge cases, and terminology conflicts.
- Inspect objective repository evidence before asking focused questions.
- Resolve only decisions that materially change scope, behavior, or constraints.

Rejected:

- Always running clarification, a fixed question count, cosmetic questions, and mandatory per-section approval.

## `sdd-plan`

Sources inspected:

- `mouredev/hello-sdd`: `habits-cli/specs/001-habits-mvp/plan.md` and planning sections of `samples/prompts.md` and `habits-cli/README.md`.
- `obra/superpowers`: `skills/writing-plans/SKILL.md`.
- `DietrichGebert/ponytail`: `skills/ponytail/SKILL.md`.
- `mattpocock/skills`: `skills/engineering/codebase-design/SKILL.md` and `docs/engineering/codebase-design.md`.

Adapted:

- Concrete affected areas, interfaces, risk, evidence, and compatibility decisions.
- Existing pattern/stdlib/platform/dependency search before invention.
- Minimum implementation and REQUIRED NOW / USEFUL SOON / SPECULATIVE classification.
- UI-design and ADR routing decisions.

Rejected:

- Universal TDD, mandatory frequent commits, line-by-line coding recipes, persistent intensity modes, and shortest-code dogmatism.

## `sdd-tasks`

Sources inspected:

- `mouredev/hello-sdd`: `habits-cli/specs/001-habits-mvp/tasks.md` and task sections of `samples/prompts.md` and `habits-cli/README.md`.
- `mattpocock/skills`: `skills/engineering/to-tickets/SKILL.md` and `docs/engineering/to-tickets.md`.
- `gastownhall/beads`: `README.md`, `docs/index.md`, `docs/getting-started/quickstart.md`, and `docs/reference/troubleshooting.md`.

Adapted:

- Verifiable outcomes traced to requirements.
- Prefer vertical slices; use explicit blocker edges and a ready frontier.
- A task is ready only when all blocking dependencies are complete.

Rejected:

- Fixed 20–30 minute sizing, mandatory tracker publication, Beads/Dolt storage, hash IDs, formulas, molecules, gates, sync, and multi-agent dispatch.

## `sdd-implement`

Sources inspected:

- `obra/superpowers`: `skills/executing-plans/SKILL.md`.
- `obra/superpowers`: `skills/systematic-debugging/SKILL.md`.
- `mattpocock/skills`: `skills/engineering/implement/SKILL.md`, `docs/engineering/implement.md`, and `skills/engineering/implement-spec/SKILL.md`.
- `mouredev/hello-sdd`: implementation sections of `samples/prompts.md` and `habits-cli/README.md`.

Adapted:

- Work one ready task from its spec and plan, load only relevant context, update status, and preserve a validation record.
- Treat silent plan/spec deviations as defects in traceability.
- Focused checks during implementation and broader validation at the proper boundary.
- Gather evidence and find the root cause before attempting a fix for an unexpected failure.

Rejected:

- Universal TDD, automatic commits, worktrees, subagent orchestration, tracker mutation, rigid debugging ceremony, and continuous execution despite material requirement defects.

## `sdd-review`

Sources inspected:

- `mattpocock/skills`: `skills/engineering/code-review/SKILL.md` and `docs/engineering/code-review.md`.
- `DietrichGebert/ponytail`: `skills/ponytail-review/SKILL.md` and `skills/ponytail/SKILL.md`.

Adapted:

- Independent SPEC and STANDARDS questions with cited evidence.
- A third SIMPLICITY axis for deletion, duplicate mechanisms, avoidable dependencies, and speculative abstractions.
- Review reports findings without silently fixing them.

Rejected:

- Mandatory parallel subagents, tool-specific base-selection or approval ceremony, issue-tracker setup, a hard-coded smell catalog as universal law, line-count scoring, and terse-only findings.

## `sdd-validate`

Sources inspected:

- `obra/superpowers`: `skills/verification-before-completion/SKILL.md`.
- `mouredev/hello-sdd`: validation sections of `samples/prompts.md`, `habits-cli/README.md`, and the requirement-to-test pattern in `habits-cli/specs/001-habits-mvp/spec.md`.

Adapted:

- No completion claim without fresh, claim-relevant evidence.
- Identify the claim, run the real command or check, read its complete result, then report PASS/FAIL/PARTIAL honestly.
- Validate acceptance criteria separately from tooling health.

Rejected:

- Running every possible suite regardless of relevance and treating a passing test suite as proof of all requirements.

## `sdd-change`

Sources inspected:

- `mouredev/hello-sdd`: change sections of `samples/prompts.md` and `habits-cli/README.md`.
- This framework's own spec, plan, task, architecture, and ADR traceability model.

Adapted:

- Requirements change before implementation changes.
- Impact analysis across affected requirements, acceptance criteria, design, tasks, decisions, and code.
- Preserve unaffected content and identify invalidated evidence.

Rejected:

- External change-management infrastructure and whole-document rewrites for local changes.

## `ui-design`

Sources inspected:

- `anthropics/skills`: `skills/frontend-design/SKILL.md` and its `LICENSE.txt`.
- `openai/plugins`: `plugins/figma/skills/figma-generate-design/SKILL.md`.
- `openai/skills` (historical, deprecated): `skills/.curated/figma-generate-design/SKILL.md`, `skills/.curated/figma-implement-design/SKILL.md`, and `skills/.curated/figma-generate-library/SKILL.md`.

Adapted:

- Design choices grounded in product context, audience, content, and a deliberate hierarchy rather than generic templates.
- Intentional typography, layout, restraint, content, interaction feedback, and avoidance of repeated AI-default aesthetics.
- Inspect and reuse existing screens, components, tokens, and design-system conventions before adding patterns.
- Separate design intent from implementation and validate responsive/accessibility states honestly.

Rejected:

- Frontend code generation, fixed stacks, Figma-specific tooling requirements, mandatory visual novelty, invented product goals/personas, and claims of WCAG conformance without verification.

## Context, tools, validation, and memory policy

Official sources recorded:

- OpenAI, [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).
- Graphify, [official repository](https://github.com/Graphify-Labs/graphify).
- Serena, [tool documentation](https://oraios.github.io/serena/01-about/035_tools.html).
- Context7, [CLI Skill setup](https://raw.githubusercontent.com/upstash/context7/master/skills/context7-cli/references/setup.md).
- Engram, [technical reference](https://github.com/Gentleman-Programming/engram/blob/main/DOCS.md).
- dependency-cruiser, [official repository](https://github.com/sverweij/dependency-cruiser).
- ast-grep, [rewrite documentation](https://ast-grep.github.io/guide/rewrite-code.html).
- Knip, [getting started](https://knip.dev/overview/getting-started).
- Semgrep, [running rules](https://semgrep.dev/docs/running-rules).
- Playwright, [coding-agent CLI guidance](https://playwright.dev/python/docs/getting-started-cli).
- Repomix, [official README](https://github.com/yamadashy/repomix/blob/main/README.md?plain=1).

Adopted:

- Progressive disclosure with one shared stopping ladder rather than broad default reading.
- Local deterministic evidence first, optional tools only on explicit triggers, and a native fallback for every candidate.
- Change-surface classification, acceptance/risk-linked checks, an explicit full-validation decision, and separation of regressions from baseline debt.
- Provider-agnostic, selective memory whose authority is lower than repository artifacts and ADRs.
- CLI or low-surface modes over permanently loaded tool schemas when they provide equivalent evidence.

Rejected or deferred:

- New SDD Skills, `sdd/prompts/`, mandatory external tools, automatic installation, generated graphs, and universal full-suite validation.
- Graphify Skills, MCP, hooks, or always-loaded guidance; Serena in this documentation repository; Context7 until a versioned dependency contract requires it.
- Engram plugin/MCP/hooks and any persistent memory provider without a continuity pilot.
- dependency-cruiser, ast-grep, Knip, Semgrep, Playwright, and Repomix installation where no matching code or product surface exists.
- Cavecrew/Caveman integration, proxying, compression wrappers, model routing, or subagent orchestration. Independent focused Skills are outside this framework decision.

## Licenses and attribution posture

- `openai/codex`, `mouredev/hello-sdd`, and the inspected Anthropic `frontend-design` material publish Apache-2.0 license terms.
- `obra/superpowers`, `mattpocock/skills`, `DietrichGebert/ponytail`, and `gastownhall/beads` publish MIT license terms.
- Agent Skills publishes code under Apache-2.0 and documentation under CC-BY-4.0 as described in its README.
- No upstream code, templates, or substantial prose is vendored here. Names and paths are retained only for factual attribution and future source verification.
