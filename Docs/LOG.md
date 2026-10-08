# GroundQ Implementation Log

This file records the actual implementation state of the project.

Agents must read this file before making changes.

## [2026-10-09] — Full Validation and Live Project Flow

### Type
Testing / Runtime / Integration

### Status
Verified locally and against the authenticated Supabase project.

### Verification
- Prettier check — passed.
- ESLint — passed.
- Contracts, API, and web TypeScript checks — passed.
- Contracts tests — passed (3 tests).
- API tests — passed (2 tests).
- Web tests — passed (3 tests).
- E2E suite — passed (3 tests).
- API health endpoint — returned 200.
- Unauthenticated project access — returned the expected 401 response.
- Authenticated workspace loaded projects from Supabase.
- Authenticated project creation succeeded and the created project appeared in the workspace.
- The temporary live-test project was archived after verification and is no longer shown in the default project list.

### Environment Note
The installed shell did not expose `corepack` or `pnpm`, so validation and startup used the pinned pnpm version through `npx pnpm@9.15.5`. The API now runs on port 3001 and the web app runs on the available Vite port.

## [2026-10-08] — Auth and Project Slice Gap Fixes

### Type
Feature / Bug Fix / API / Security / Testing

### Status
Implemented locally; remote profiles/projects migration applied and verified.

### Changes
- Added `/update-password` and connected password-reset emails to the password update flow.
- Implemented password visibility controls and removed the previously inert behavior.
- Added project get, update, archive, archived filtering, and bounded opaque-cursor pagination endpoints.
- Added shared Zod schemas for projects, generation blueprints, question versions, validation checks, and API errors.
- Added API error mapping for not-found, forbidden, conflict, and validation failures.
- Added regression tests for unauthenticated project access, shared project validation, and the password update route.
- Applied the versioned profiles/projects migration through the authenticated Supabase SQL Editor.
- Made the migration policy section replay-safe for future CLI migration synchronization.

### Verification
- Supabase SQL Editor reported `Success. No rows returned` for the migration.
- Read-only verification confirmed `profiles` and `projects` exist with RLS enabled.
- Live web verification confirmed `/update-password` renders.
- Static editor diagnostics are clean for all changed source and test files.

### Follow-up
- Continue with the resource-management vertical slice after the authenticated project workflow is accepted.

## [2026-10-08] — Verify Supabase Auth Provider Configuration

### Type
Configuration / Authentication

### Status
Verified in the authenticated Supabase dashboard.

### Verified State
- User sign-ups are enabled.
- Email provider is enabled.
- Google provider is enabled.
- Email confirmation is enabled.
- Site URL and allowed redirect URL are configured for `http://localhost:5173`.

### Validation
- The dashboard reports the provider settings above as enabled.
- The local sign-in page loads at `/sign-in`.
- Automated clicking of the local Google button timed out while waiting for the page element to stabilize, so a completed Google OAuth login was not claimed.

## [2026-10-08] — Complete Local Supabase Client Runtime Configuration

### Type
Configuration / Authentication

### Status
Implemented locally; remote provider configuration remains pending Supabase authentication.

### Changes
- Added the ignored API runtime environment file so the backend can validate browser-issued Supabase access tokens and serve authenticated project requests.
- Added `apps/api/.env.example` with the required backend configuration and no credentials.
- Kept the browser Supabase client on the publishable `VITE_*` variables and the backend on server-side `SUPABASE_*` variables.

### Verification
- API auth configuration files report no editor diagnostics.
- The local API environment file is covered by the repository's ignored `.env` rules.

### Blocker
Supabase Dashboard and MCP management requests are unauthenticated in the current session, so Email/Google providers, redirect URLs, and the pending migration cannot be changed remotely here.

## [2026-10-08] — Fix Google Sign-Up Action

### Type
Bug Fix / Authentication

### Status
Implemented and verified locally.

### Changes
- Connected the create-account page's Google button to Supabase `signInWithOAuth` with the local `/app` redirect instead of navigating to the sign-in page.
- Preserved the existing email/password sign-up and sign-in flows.

### Tests
- `corepack pnpm --filter @groundq/web lint` — passed.
- `corepack pnpm --filter @groundq/web typecheck` — passed.
- `corepack pnpm --filter @groundq/web test` — passed (2 tests).
- `corepack pnpm --filter @groundq/web build` — passed.

### Follow-up
Supabase Auth must have Email enabled, Google enabled with valid provider credentials, and `http://localhost:5173/app` configured as an allowed redirect URL before hosted authentication can complete.

## [2026-10-08] — Supabase Auth and Projects Vertical Slice Stabilization

### Type
Feature / Integration / Code Quality / Documentation

### Status
Implemented locally and verified; Supabase migration remains unapplied remotely.

### Changes
- Completed the local Supabase Auth browser integration for password sign-in, account creation, Google OAuth initiation, password recovery, and session-based workspace access.
- Completed the API foundation for authenticated `GET /api/v1/me` and ownership-scoped project listing and creation under `/api/v1/projects`.
- Added the profiles/projects migration with profile creation from `auth.users`, timestamps, ownership indexes, and RLS policies.
- Corrected the API authentication request typing to remain compatible with the installed Express 5 typings and ESLint rules.
- Configured API Vitest to use a single thread, avoiding the Windows `spawn EPERM` worker failure.
- Registered the Supabase MCP server in `.vscode/mcp.json` for the configured project and requested database/development/function capabilities. OAuth authentication is host-managed; no remote migration was applied by this work.

### Files
- `.vscode/mcp.json`
- `apps/api/src/middleware/require-auth.ts`
- `apps/api/src/routes/me.ts`
- `apps/api/src/routes/projects.ts`
- `apps/api/vitest.config.ts`
- `docs/LOG.md`

### Tests
- `corepack pnpm format:check` — passed after formatting the changed files.
- `corepack pnpm lint` — passed.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm test` — passed (4 tests).
- `corepack pnpm build` — passed.
- API focused lint, typecheck, and test checks — passed.

### Follow-up
Apply and review the versioned Supabase migration through the authenticated Supabase workflow before relying on `/me` or project persistence against the hosted database. The current terminal does not include the `codex` CLI or direct Supabase MCP tool surface, so remote MCP verification could not be performed here.

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
