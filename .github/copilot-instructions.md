# GitHub Copilot instructions

This repository uses one shared SDD core for cross-host workflows.

- Follow `AGENTS.md` first for repo-wide routing and the Definition of Done.
- Use the shared framework under `.agents/skills/` and `sdd/`; do not create a second Codex-only or Copilot-only version of the workflow.
- Keep the SDD as a single source of truth. Do not duplicate skills under `.github/skills` unless a real platform constraint makes it necessary.
- Use the host-appropriate skill invocation syntax:
  - Codex: `$sdd-specify`, `$sdd-plan`, `$sdd-review`, ...
  - GitHub Copilot: `/sdd-specify`, `/sdd-plan`, `/sdd-review`, ...
- Avoid a full SDD workflow for trivial changes; apply the smallest relevant task or direct edit when the repository evidence already answers the question.
