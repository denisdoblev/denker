# SDD framework repository

This repository contains reusable Spec-Driven Development templates and Codex Agent Skills. Keep the framework smaller than the development problems it is meant to simplify.

## Context router

- Read `sdd/README.md` when changing the workflow, artifact model, or repository layouts.
- Read `sdd/UPSTREAM.md` when changing behavior attributed to an upstream project or updating skill-format assumptions.
- Read the affected file in `sdd/templates/` when changing a project artifact contract.
- Read only the affected `.agents/skills/<name>/SKILL.md`; load its `references/` file only for the mode it documents.
- Read only the relevant section of `sdd/POLICIES.md` when context, tool, validation, or memory policy affects the work.
- Within an initialized project, the nearest scoped documentation supplements or overrides global documentation unless it conflicts with the constitution.

## Global principles

- Evidence over assumptions; explicit requirements over inferred ones.
- Existing patterns, language, framework, and platform capabilities before new abstractions or dependencies.
- Specs define what and why; plans define how; tasks define executable outcomes.
- Architecture documents current state. ADRs record only durable, consequential decisions.
- Match process depth to uncertainty, blast radius, reversibility, migration impact, and user impact.
- Select context, tools, validation depth, and optional memory according to `sdd/POLICIES.md`.
- Do not copy upstream text or behavior without checking the current official source and its license.
- Do not add a skill, artifact, abstraction, or workflow without a demonstrated recurring need.

## Definition of Done

When applicable:

- Requirements and acceptance criteria are satisfied and traced to current evidence.
- Relevant focused tests and appropriate broader checks pass.
- The repository's real typecheck, lint, and build checks pass when they support the claims being made.
- Behavior, architecture, conventions, and durable decisions are documented where they changed.
- No unjustified out-of-scope change or unresolved critical review finding remains.
- No success claim is made without fresh evidence from the current work.

Discover commands from repository configuration and documentation; never assume package-manager commands.
