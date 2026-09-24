# GroundQ Implementation Log

This file records the actual implementation state of the project.

Agents must read this file before making changes.

---

## [2026-09-23] — Frontend Modularization and Auth Cleanup

### Type
Refactor / UI / Code Quality

### Status
Implemented

### Review Findings
The prior implementation concentrated routing, shared primitives, landing-page sections, authentication screens, and auth styling concerns in a single 1,086-line App.tsx. This made ownership unclear and increased the cost of safely changing one screen.

### Changes
- Reduced apps/web/src/app/App.tsx to route composition only.
- Moved shared icons, branding, navigation, portal layout, auth fields, and auth primitives to apps/web/src/app/components/ui.tsx.
- Moved the long landing experience and its preview components to apps/web/src/app/pages/LandingPage.tsx.
- Moved sign-in, account creation, and password recovery to apps/web/src/app/pages/AuthPages.tsx.
- Removed dead split-screen auth code and its unused CSS.
- Removed Stitch-only RESEARCH PORTAL and preview/state controls from the actual auth UI.

### Tests
- corepack pnpm format:check — passed
- corepack pnpm lint — passed
- corepack pnpm typecheck — passed
- corepack pnpm test — passed
- corepack pnpm build — passed
- corepack pnpm test:e2e — passed (3 tests), including absence checks for reference-only controls

### Follow-up
As the product grows, split LandingPage.tsx into feature-level marketing components and replace the shared stylesheet with co-located component styles where that improves ownership.

---

## [2026-09-23] — Stitch Fidelity Pass

### Type
UI / Feature

### Status
Implemented

### Summary
Reworked the professor-facing landing/auth demo to follow the Stitch Research Portal screens more strictly while preserving the approved grounding-language, sign-in CTA, long-page, responsive, and visual-auth decisions.

### Files
- apps/web/src/app/App.tsx
- apps/web/src/styles/index.css
- apps/web/test/app.test.tsx
- tests/e2e/scaffold.spec.ts
- docs/LOG.md

### Technical Details
Replaced the custom split-screen sign-in concept with the shared Stitch portal shell and centered card layout. Added visual-only /sign-up and /password-recovery routes with Stitch-aligned tabs, institutional fields, password/recovery states, validation/status copy, local/Ollama federation note, and portal footer. Landing content continues to use the approved resource-grounding language and routes primary actions to /sign-in.

### Tests
- corepack pnpm format — passed
- corepack pnpm lint — passed
- corepack pnpm typecheck — passed
- corepack pnpm test — passed
- corepack pnpm build — passed
- corepack pnpm test:e2e — passed (3 tests)
- Desktop route screenshots — reviewed for landing, sign-in, create account, and password recovery

### Decisions
Authentication remains a presentation/demo surface; Supabase Auth integration is deferred. The Stitch visual structure is authoritative except for the previously approved copy and CTA changes.

### Follow-up
Connect the visual auth forms to Supabase Auth after the demo shell is accepted.

---

## [2026-09-23] — Stitch Landing Page

### Type
UI / Feature

### Status
Implemented

### Summary
Implemented the full responsive GroundQ landing page based on the approved Stitch design, plus a visual sign-in route for the professor-facing demo.

### Files
- `apps/web/src/app/App.tsx`
- `apps/web/src/styles/index.css`
- `apps/web/test/app.test.tsx`
- `tests/e2e/scaffold.spec.ts`
- `docs/LOG.md`

### Technical Details
The page includes the long-form hero, blueprint preview, generated-question evidence panel, validation pipeline, feature comparison, four-stage workflow, question-bank preview, final CTA, responsive navigation, and footer. Absolute “zero hallucination” language was replaced with evidence-linked grounding language. All primary CTAs route to `/sign-in`; Supabase authentication remains deferred.

### Tests
- `corepack pnpm format:check` — passed
- `corepack pnpm lint` — passed
- `corepack pnpm typecheck` — passed
- `corepack pnpm test` — passed
- `corepack pnpm build` — passed
- `corepack pnpm test:e2e` — passed
- Desktop and Chromium mobile visual QA — passed

### Decisions
Used the Stitch design tokens: Newsreader, Geist, JetBrains Mono, indigo generation accents, teal grounding accents, quiet surfaces, thin borders, and responsive editorial layouts.

### Follow-up
Connect the sign-in screen to Supabase Auth and replace demo preview data with live project/resource data in later milestones.

## [2026-09-23] — Secure Stitch MCP Configuration

### Type
Security / Configuration

### Status
Implemented

### Summary
Moved the Stitch MCP API key out of the workspace MCP configuration and into the local ignored environment file.

### Files
- `.vscode/mcp.json`
- `.env.example`
- `.env`
- `.gitignore`
- `README.md`
- `docs/LOG.md`

### Technical Details
The MCP configuration now loads `.env` and references `${env:STITCH_API_KEY}`. `.env` remains ignored by Git, while `.env.example` documents the required variable without containing a credential.

### Tests
- Verified `.env` is ignored by Git.
- Verified the MCP configuration contains no literal API key.

### Decisions
Kept the workspace MCP server configuration shareable while keeping the credential local.

### Follow-up
Because the key has been exposed in prior messages and local configuration, rotate or revoke it in the Stitch/Google credentials console and replace the local value afterward.

## [2026-09-19] — Agent Guidance Expansion

### Type
Documentation / Architecture

### Status
Implemented

### Summary
Expanded `AGENTS.md` into the complete operating guide for future AI coding agents working on GroundQ.

### Files
- `AGENTS.md`
- `docs/LOG.md`

### Technical Details
The guidance now covers required documentation reading, source-of-truth priority, discussion gates, Git safety, V1 architecture boundaries, security, provenance, lifecycle rules, validation, and final reporting.

### Tests
- Documentation-only change; no code tests required.

### Decisions
Kept the agent instructions concise and rule-oriented rather than duplicating the product specifications.

### Follow-up
Future architectural decisions should be recorded as ADRs under `docs/decisions/`.

## [2026-09-19] — Repository Scaffold

### Type
Architecture

### Status
Implemented

### Summary
Created the GroundQ pnpm monorepo foundation with web, API, shared contracts, Supabase configuration, documentation guidance, linting, formatting, type-checking, and smoke-test infrastructure.

### Files
- `apps/web/`
- `apps/api/`
- `packages/contracts/`
- `supabase/`
- `AGENTS.md`
- `README.md`
- `docs/index.md`
- `docs/LOG.md`

### Technical Details
The API exposes only `GET /api/v1/health` and does not contact Ollama during startup. The frontend is a minimal Vite application shell. Domain tables, migrations, authentication workflows, ingestion, retrieval, generation, validation, and product UI are intentionally deferred.

### Tests
- `corepack pnpm lint` — passed
- `corepack pnpm format:check` — passed
- `corepack pnpm typecheck` — passed
- `corepack pnpm test` — passed
- `corepack pnpm build` — passed
- `corepack pnpm test:e2e` — passed

### Decisions
Renamed the existing `Docs/` directory to `docs/` and normalized `API_Design.md` to `API_SPEC.md`. Pinned the workspace to pnpm 9.15.5 and Node 22.

### Follow-up
Implement Supabase domain migrations and product capabilities as separate approved tasks.
