# SDD operating policies

This file is the canonical, on-demand policy for context, tools, validation, and optional memory. Read only the section required by the current stage or risk.

## Context budget policy

Use the cheapest evidence that can resolve the current question, in this order:

1. Active request, applicable instructions, and active SDD artifact.
2. Repository state or diff, when existing changes matter.
3. File discovery or text search with `rg --files`, `rg`, or `fd` when available.
4. A justified semantic tool when text search cannot answer a symbol, boundary, or impact question.
5. Symbol or line range.
6. Whole file.
7. A compressed, selected multifile view.
8. Broad reading only when narrower evidence remains insufficient.

Stop as soon as the evidence is sufficient. Do not read an entire documentation tree, repository, or Skill collection by default. Follow links selectively and prefer the nearest scoped source. Use architecture, ADRs, conventions, glossary, and active artifacts only when their subject can constrain the work.

## Tool selection policy

Choose the least costly reliable source for the claim. Prefer deterministic local CLI and repository evidence to persistent services. Use MCP only when its unique semantics or data justify its tool and context surface. Optional tools must have a native fallback and must be discovered from the consumer project; `$sdd-init` never installs them automatically.

| Class | Tool | Trigger | Anti-trigger and fallback |
| --- | --- | --- | --- |
| Base | `git`, `rg`, range reads | State, diff, file discovery, known text, or focused inspection is relevant. | Do not run Git rituals without an evidentiary question. Use filesystem and direct reads when Git has no useful baseline. |
| Optional | Graphify | A current graph already exists and architecture, cross-cutting impact, boundaries, or conceptual paths justify a budgeted query. | Do not build a graph automatically or use it for local changes. Fall back to architecture/ADRs, `rg`, and focused reads. |
| Optional | Serena | A large codebase needs semantic references, cross-file navigation, or focused work in long source files. Prefer a low-surface interface when stable. | Do not add it to small or documentation-only repositories or duplicate shell, search, or memory. Fall back to `rg` and ranges. |
| Optional | Context7 | A versioned library contract, recent API, or breaking change cannot be established locally. Prefer CLI plus Skill if adopted. | Do not use for basic concepts or locally evidenced behavior. Fall back to targeted official documentation. |
| Optional | dependency-cruiser | A JS/TS project has documented import boundaries and an architecture/import change needs enforcement. | Do not invent boundary rules or use it universally. Fall back to existing import tests, build, and architecture review. |
| Optional | ast-grep | Syntax-aware search, a codemod, or proof that a construction disappeared is needed; preview and inspect the diff before applying. | Use `rg` for plain text or known names. Fall back to focused search and edits. |
| Optional | Knip | A JS/TS change removes or moves modules, exports, or dependencies and unused-code evidence matters. Compare with the existing baseline. | Do not run after unrelated small changes or absorb prior debt into scope. Fall back to build, typecheck, and focused references. |
| Optional | Semgrep | A security-sensitive change warrants selected rules for a supported language. | Do not use indiscriminate or automatic rulesets as ceremony. Fall back to focused security tests and review. |
| Optional | Playwright | A UI product has interactive acceptance criteria not sufficiently covered by lower-cost tests; reuse its existing runner first, otherwise prefer CLI plus Skill. | Do not use for backend-only behavior or adequately covered unit behavior. Fall back to the project's focused UI checks or recorded manual evidence. |
| Last resort | Repomix | Selected multifile context remains necessary after search, ranges, and suitable semantic tools; set exclusions and an explicit token budget. | Do not use for localized work or indiscriminate repository packing. Fall back to a hand-selected set of files and ranges. |
| Not recommended here | Engram | No framework integration. Apply only the provider-agnostic memory policy below. | Do not install its plugin, hooks, or MCP without a demonstrated continuity pilot. Fall back to repository artifacts and the current thread. |
| Not recommended here | Cavecrew/Caveman | No SDD dependency or integration. | Do not add proxy, shrink, wrapper, subagent, or routing machinery. Independent narrowly scoped Skills may remain outside SDD. |

No external tool is mandatory. A project may document additional tools when repeated evidence justifies them.

## Validation policy

Classify the change by every affected surface and justify the classification in the plan:

| Surface | Typical evidence |
| --- | --- |
| Docs/process | Links, paths, structure, terminology, examples, and contract consistency. |
| UI | Focused component tests; interaction, responsive, accessibility, and visual checks only when relevant. |
| Backend/API | Unit or integration tests, contract checks, error paths, and compatibility evidence. |
| Architecture | Boundary/dependency checks, architecture and ADR consistency, and affected build/tests. |
| Refactor | Behavior-preserving tests plus focused references, typecheck, build, or unused-code checks according to reach. |
| Security | Abuse and authorization cases, selected security rules, dependency or secret checks when implicated. |
| Data/migration | Forward and rollback behavior, compatibility, integrity, representative data, and operational evidence. |

Map evidence to acceptance criteria and material risks. Start focused; use full validation only when the plan says `yes`, repository policy requires it, or discovered blast radius makes it necessary. Record why a check is required, not merely that it exists.

Separate results introduced by the change from pre-existing baseline. A baseline failure does not become in scope automatically, but it can block a claim when it prevents relevant evidence or the change worsens it. Report new regression, unchanged baseline, and unknown provenance distinctly. Never claim success from stale, incomplete, or unrelated output.

## Memory policy

Repository evidence, current SDD artifacts, and applicable ADRs outrank recalled memory. Retrieve memory selectively only when continuity across sessions is relevant and a provider is already available. Discard or correct memories that conflict with current authoritative evidence.

Store only compact continuity notes: decisions and their authority, constraints, failed approaches worth avoiding, unresolved risks, and next steps. Never store source code, full files or specifications, raw logs, secrets, credentials, personal data, or facts trivially reconstructible from the repository. Memory is optional and must not become a prerequisite for the workflow.
