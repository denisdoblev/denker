---
name: sdd-init
description: Initialize or repair the repository's SDD structure after inspecting its real layout, instructions, tooling, and existing documentation. Use when adopting this framework in a new or existing simple repository or monorepo without overwriting local decisions.
---

# SDD Init

Create the smallest useful SDD foundation for the repository. Treat existing files as project evidence, not obstacles to replace.

## Procedure

1. Inspect before writing:
   - Find applicable `AGENTS.md` files and product documentation that may define architecture, conventions, commands, or existing decisions.
   - Treat `sdd/` as framework material, not product documentation. Do not read `sdd/UPSTREAM.md` unless resolving an upstream compatibility or source question.
   - Inspect manifests, workspaces, packages, apps, services, libraries, source and test roots, tool configuration, and CI definitions.
   - Determine whether the repository is simple or a monorepo from that evidence. Do not infer a monorepo from directory names alone.
   - Record existing architecture, conventions, commands, and conflicts with the proposed SDD layout.
   - Follow the context and tool policies in `sdd/POLICIES.md`. Discover useful existing tools and configurations, but never install or activate them.
2. Choose a proportional layout using `sdd/README.md`:
   - In a simple repository, prefer root instructions, shared docs, and feature folders under `specs/`.
   - In a monorepo, keep the constitution and system architecture global. Add scoped `AGENTS.md`, architecture, or conventions only where a workspace genuinely differs.
   - Keep feature specifications oriented around user or system outcomes rather than package boundaries.
3. Present collisions before changing an existing SDD or instruction file. Preserve useful local content and merge deliberately; never replace it blindly.
4. Select only currently useful artifacts:
   - Root `AGENTS.md` router and definition of done.
   - Constitution, architecture, and conventions when their content is known.
   - `specs/` content only for active work.
   - Glossary and ADRs lazily, when shared terminology or durable decisions exist, in the nearest scope they govern.
5. For each selected artifact, read only its matching file in `sdd/templates/`. Adapt headings and examples to repository evidence rather than scanning every template or copying every section.
6. Validate the result:
   - Scope and precedence of instructions are unambiguous.
   - Internal paths and links resolve.
   - Documented commands actually exist.
   - No empty ceremonial documents or invented facts were added.

## Safety rules

- Do not modify product code, install dependencies, Skills, plugins, or MCP servers, create a database, add CI, or introduce a framework CLI.
- Do not overwrite project-specific rules or silently resolve conflicts.
- If a material choice cannot be derived from the repository, leave it explicit and ask for direction.

## Report

Summarize the detected topology, files created or merged, preserved decisions, conflicts, and any artifacts intentionally deferred.
