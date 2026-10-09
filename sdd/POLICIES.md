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

### Local-assisted context routing

`local-assisted` is optional evidence preparation, not delegated judgment. The repository and accepted artifacts remain authoritative. Route in this order:

1. Keep `direct` as the default and use it for known bounded sources, exact-text work, specs, authority documents, templates, Skills, and SDD contracts. Never choose Ollama or `local-assisted` autonomously.
2. Only when the user explicitly requests Ollama or `local-assisted`, enumerate with `git ls-files` and fall back to `rg --files`; search explicit paths, terms, and meaningful words with `rg`.
3. If deterministic anchors are insufficient, the local model may suggest at most eight terms and six paths. Retain only existing paths and terms that produce deterministic repository matches.
4. Expand bounded candidates through local imports/references and related tests. Rank explicit paths and independent signals before weaker matches.
5. Read files up to 400 lines completely. For larger files, use ±80-line ranges around evidence and merge gaps of at most 20 lines.
6. Classify candidates structurally and choose a dynamic implementation frontier of two to four files, stopping weak score tails. Target 14K selected source tokens while retaining the 20K hard ceiling; reserve 80% of the target for implementation and cap oversized excerpts around distributed anchors. Complete the packet only when a candidate adds a new import/reference/related-test edge or is explicit, cap each completion excerpt at 2K, and match related tests by exact source stem. Lexical coincidence alone is insufficient. Send at most twelve files and 21K estimated source tokens to Ollama, split across at most three 7K-token batches. Authority documents remain recommended direct reads and are never sent to Ollama.
7. Give every Ollama excerpt a closed ID and require the model to cite only those IDs; translate IDs to repository path and full inclusive excerpt range deterministically before producing the external packet. Treat `technical_status=ok` only as successful execution and a valid local contract. Report coverage separately as `sufficient`, `partial`, or `unknown`; `sufficient` is a conservative runtime heuristic, not a benchmark-quality guarantee. The runner injects a packet only when technical status is `ok` and coverage is `sufficient`. Timeouts, invalid IDs/contracts/citations/paths/ranges, changed hashes, tool errors, or partial/unknown coverage fall back immediately to `direct`.

The packet records search commands and counts, selected paths/ranges/reasons, source hashes, cited facts and inferences, recommended direct reads, errors, and observed timings/bytes/tokens. It never persists prompts, source excerpts, model reasoning, or counterfactual savings. The local model may only discover, read, and synthesize factual evidence. Only the configured Codex decision model interprets requirements, makes decisions, edits, reviews, validates, or issues a verdict.

The bounded runner applies opt-in `local-assisted` only before `IMPLEMENT`; `REPAIR`, `REVIEW`, and `VALIDATE` remain direct. Experimental gates are required recall ≥95% per case, aggregate precision ≥90%, zero invalid citations or critical omissions, quality delta no worse than −5 points per case, correct repair in both modes, fallback ≤25%, median cloud-input reduction ≥40%, and non-negative savings in at least three of four paired cases. A quality failure rejects the experiment; passing quality without utility is safe but not useful. No result changes the default automatically.

## Implementation-cycle policy

For work managed through SDD, entering implementation starts the default `IMPLEMENT → REVIEW → VALIDATE` cycle. A repairable review finding or validation delta returns to `REPAIR`, followed again by `REVIEW → VALIDATE`. The cycle ends only with successful validation, an external blocker, a required human decision, or an explicit user request to stop. Review and validation remain independent phases with fresh evidence even when the host executes them automatically.

The following tasks must never be delegated to the local preprocessor: ambiguous requirement interpretation; product or scope decisions; architecture or trade-offs; security, permissions, or privacy; concurrency, transactions, migrations, or compatibility; public contracts or protocols; final causal diagnosis; fix selection; writing or applying changes; final review; or validation verdicts.

Before using local-assisted evidence, directly read every authority contract and every cited range that affects an edit or material decision. An invented path, symbol, or range invalidates the whole packet. A changed source hash forces direct fallback. Evidence-free claims are uncertainties. Local-assisted evidence never replaces an exact diff, source contract, or real validation command.

## Tool selection policy

Choose the least costly reliable source for the claim. Prefer deterministic local CLI and repository evidence to persistent services. Use MCP only when its unique semantics or data justify its tool and context surface. Optional tools must have a native fallback and must be discovered from the consumer project; `$sdd-init` never installs them automatically.

| Class | Tool | Trigger | Anti-trigger and fallback |
| --- | --- | --- | --- |
| Base | `git`, `rg`, range reads | State, diff, file discovery, known text, or focused inspection is relevant. | Do not run Git rituals without an evidentiary question. Use filesystem and direct reads when Git has no useful baseline. |
| Optional | Graphify | A human explicitly chooses its standalone CLI for manual exploration. It is not part of context routing or the runner. | Do not install its adapter, MCP, hooks, rebuild it silently, or inject its output automatically. Keep `graphify-out/` ignored and fall back to `rg` and focused reads. |
| Optional | Ollama local agent | Explicit `local-assisted` discovery benefits from cited compression and `qwen3:8b` is already available. | Never delegate decisions, edits, review, or verdicts. Enforce the v3 packet contract (with the internal v2 bulk-reader request), separate technical and coverage status, path/hash/range checks, three 7K-token batches, 21K source tokens, 90 seconds total, and direct fallback. |
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
