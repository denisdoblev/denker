# Architecture

**Scope:** [global system | app/package/service name]
**Status:** current state as of [date or version]

Describe what exists. Keep proposals in a plan or ADR.

## System context

[Users, neighboring systems, and this scope's role.]

## Components and responsibilities

| Component | Responsibility | Owns | Must not own |
| --- | --- | --- | --- |
| [name] | [purpose] | [data/behavior] | [boundary] |

## Boundaries and dependency direction

[Allowed dependency direction, public interfaces, and prohibited coupling.]

## External integrations

| Integration | Purpose | Boundary/adapter | Failure considerations |
| --- | --- | --- | --- |
| [system] | [why] | [where] | [relevant behavior] |

## Relevant data flows

[Only flows needed to understand cross-component behavior.]

## Cross-cutting concerns and constraints

[Security, observability, reliability, compliance, performance, deployment, or other real constraints.]

## Trade-offs

[Current compromises and why they are accepted. Link ADRs where relevant.]

## Scope hierarchy

In a monorepo, the global architecture explains relationships among apps, packages, and services. Local architecture explains internals for one scope and links to the global document instead of repeating it.
