# GroundQ Agent Instructions

These rules apply to every AI coding agent working in this repository.

## Before making changes

1. Read this file first.
2. Read `docs/index.md`.
3. Read the relevant authoritative documents in this order:
   - `docs/PRD.md`
   - `docs/SYSTEM_DESIGN.md`
   - `docs/DATABASE_DESIGN.md`
   - `docs/API_SPEC.md`
4. Read `docs/LOG.md`.
5. Inspect the repository structure and run `git status`.
6. If unexpected uncommitted changes exist, stop and report them. Do not overwrite another agent's work.

## Requirements and decisions

- Follow this source-of-truth order: explicit user decisions, PRD, system design, database design, API specification, documented decisions, existing implementation, convenience.
- Do not invent product requirements, silently reinterpret the product, or broaden the task.
- For material product or architectural ambiguity, explain the issue, recommend an option, ask for approval, and wait before coding.
- Do not modify `docs/PRD.md`, `docs/SYSTEM_DESIGN.md`, `docs/DATABASE_DESIGN.md`, or `docs/API_SPEC.md` without explicit approval.
- Keep each change scoped to the approved task and avoid unrelated formatting or refactoring.

## Git and file safety

- Never use `git reset --hard`, `git checkout --`, or `git clean -fd` unless explicitly instructed.
- Never force-overwrite, delete, or revert another developer's uncommitted work.
- Prefer recoverable, targeted changes. Verify targets before moving or deleting files.
- Do not commit secrets, `.env` files, credentials, tokens, or private user data.

## GroundQ V1 boundaries

Preserve the approved localhost modular-monolith architecture:

- React + TypeScript + Vite + Tailwind CSS + shadcn/ui preparation
- Node.js + TypeScript + Express
- pnpm workspaces
- Shared TypeScript/Zod contracts
- Supabase PostgreSQL, Auth, Storage, and pgvector
- Local Ollama inference and local embeddings
- REST/JSON under `/api/v1`

Do not introduce Prisma or another ORM, cloud LLM providers, public deployment infrastructure, Redis, Kafka, RabbitMQ, Kubernetes, microservices, or distributed workers without explicit approval.

Do not prematurely implement grading, adaptive learning, tutoring/chatbot behavior, performance analytics, web search, model comparison, numerical solving, or a research dashboard.

When working on domain features:

- Enforce user/project ownership on every project-scoped operation.
- Keep PostgreSQL/Supabase as the source of truth.
- Preserve resource provenance, question version history, and version-specific validation.
- Keep duplicate detection project-scoped.
- Do not silently relax generation constraints or falsify accepted/review counts.
- Use archive-first lifecycle rules; do not hard-delete through normal product actions.
- Keep privileged Supabase credentials on the backend only.
- Keep model-specific code behind interfaces; never expose Ollama directly to the browser.

## Documentation and validation

- Update `docs/LOG.md` after every meaningful feature, fix, refactor, dependency, configuration, API, database, AI, UI, or security change.
- Log only work that has actually been implemented and verified, using the real current date.
- Add an ADR under `docs/decisions/` for meaningful new architectural decisions.
- Run relevant formatting, linting, type-checking, build, unit, integration, and E2E checks before completion.
- Do not claim a check passed if it was not run. Clearly report environment-related blockers.
- Final reports should include a summary, files created/modified, dependencies, commands and results, decisions, deferred work, and confirmation of the log update.
