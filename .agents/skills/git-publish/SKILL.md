---
name: git-publish
description: Organize an existing Git working tree into coherent thematic Conventional Commits and optionally push them. Use when the user asks to commit, publish, or upload current repository changes without rewriting unrelated history.
---

# Git Publish

Turn the current working tree into a small, reviewable commit series while preserving the user's work.

## Procedure

1. Inspect repository instructions, `git status`, the complete tracked and untracked diff, the current branch, its upstream, and recent commit style. Do not assume every change belongs to the same task.
2. Identify cohesive themes from behavior and intent, not merely directories or file extensions. Keep code, its tests, and directly coupled documentation together. Separate independent product, framework, tooling, and documentation changes when each commit remains internally truthful.
3. Flag suspicious generated files, secrets, credentials, or unrelated edits instead of committing them silently. Never discard, overwrite, reformat, or repair user changes solely to make the history cleaner.
4. Run fresh checks proportional to each theme and the repository's own instructions. Do not bypass failing hooks or claim success from stale or unrelated evidence.
5. Stage exact paths or hunks for one theme at a time. Before every commit, inspect the staged diff and run `git diff --cached --check`.
6. Write a Conventional Commit subject as `type(scope): imperative summary`. Choose the narrowest truthful type and scope; do not invent issue references or breaking-change markers.
7. Create commits in dependency order so the series is understandable and each commit is as self-contained as the change permits. Recheck the working tree and recent history after committing.
8. Push only when the user explicitly requested publishing, uploading, or pushing. Use the current branch and its configured remote/upstream; never force-push, amend, rebase, or rewrite history unless separately requested.

## Boundaries

- Invocation authorizes creating ordinary local commits from the changes in scope, but does not authorize content changes beyond the publishing task.
- If commit grouping is materially ambiguous, preserve the changes and ask for the missing intent rather than guessing.
- If hooks or validation fail, leave recoverable state, report the exact failure, and do not push.
- If there is nothing to commit, report that without creating an empty commit.

## Report

List the created commits in order, the checks run and their results, any changes intentionally left uncommitted, and whether the remote was updated.
