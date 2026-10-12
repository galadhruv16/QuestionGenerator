# GroundQ Implementation Log

This file records the actual implementation state of the project.

Agents must read this file before making changes.

## [2026-10-12] — Fixed Ingestion Pipeline Scanned Document Reporting & Topics Mock Bleed

### Type
Bug Fix / AI Pipeline / UI / Verification

### Status
Implemented and verified locally.

### Root Cause Analysis
1. **Pipeline Failure on `SHA CSS.pdf`**:
   - The user uploaded `SHA CSS.pdf` (6.3 MB, 13 pages). Direct byte analysis verified that the file consists solely of raster image scans (`/Font: true`, `/Text: false`, `/Image: true`). Text extraction via `pdf-parse` returned `totalExtractedChars: 0`.
   - Per `PRD.md` Section 15 and `SYSTEM_DESIGN.md`, GroundQ V1 deterministically requires digital PDFs with selectable vector text layers; OCR/scanned document processing is explicitly out of scope for V1 to guarantee 0% hallucination rates.
   - The engine correctly flagged this as non-extractable (`SCANNED_DOCUMENT`), set `resources.status = FAILED`, and recorded the failure message in `resource_processing_runs`.
   - However, `resources` table lacked `failure_reason` column, and `loadData()` on the frontend didn't query `GET /resources/:id/status`, causing the UI to merely display generic "FAILED / Processing failed" without communicating the scanned PDF rejection reason to the user.
   - Furthermore, `getEmbedding` in `resource-processor.ts` had an overly aggressive 2.5s timeout that aborted during local Ollama cold starts.
2. **Topics Page Mock Text Bleed**:
   - When 0 resources are processed, `ProjectTopicsPage.tsx` entered `viewMode = 'zero'`.
   - A logic bug in line 916 (`viewMode !== 'empty'`) evaluated to true for `'zero'`, inadvertently rendering the two-column hierarchy layout underneath the warning banner.
   - Inside the right-hand Grounding Evidence Inspector, null checks defaulted to hardcoded strings: `"1.1 Banker's Algorithm & Resource Allocation"`, `"Module 1: Process Synchronization & Deadlocks"`, and `"Silberschatz OS (Ch. 8)"`.
   - Breadcrumb headers also had fallback values referencing `"Distributed Systems Spring 2025 (CS-842)"`.
3. **Missing Polling & Loading States**:
   - `ProjectResourcesPage.tsx` did not poll during `PROCESSING` states, causing users to get stuck on optimistic stage indicators unless they navigated away and returned.
   - Lack of an explicit `isLoading` state caused an empty screen flash on mount.

### Changes
- Enhanced [resource-processor.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/services/resource-processor.ts):
  - Increased local Ollama embedding inference timeout from 2,500ms to 15,000ms to tolerate cold-start model loads.
  - Added explicit status logging across all pipeline stages (`DOWNLOADING_FILE`, `EXTRACTING_TEXT`, `CHUNKING`, `EMBEDDING`, `COMPLETED`, `FAILED`).
  - Improved scanned document failure message to clearly explain why the PDF was rejected and that GroundQ V1 requires text-selectable digital PDFs.
  - Added error checks on `resource_chunks.insert()`.
- Updated [ProjectResourcesPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectResourcesPage.tsx):
  - Added automatic polling interval (every 2.5s) while any resource is in `PROCESSING` or `UPLOADING` state.
  - In `loadData()`, resolved `/projects/:id/resources/:resourceId/status` for failed/processing items to dynamically retrieve `error_message` and pipeline stage.
  - Displayed descriptive summary (`Scanned document · No selectable digital text`) in table rows when a scanned PDF is detected.
  - Rendered dynamic "Corpus Ingestion Blocked: 1 Scanned Document Detected" banner highlighting the exact uploaded filename.
  - Added failure reason diagnostic box in the slide-over resource inspector drawer.
  - Added `isLoading` spinner to prevent flash of empty states while data is loading.
- Fixed [ProjectTopicsPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectTopicsPage.tsx):
  - Changed condition so the two-column workspace only renders when `viewMode !== 'empty' && viewMode !== 'zero'`.
  - Removed all hardcoded fallbacks to Banker's Algorithm, Silberschatz OS, and CS-842.
  - When no subtopic is selected, Grounding Evidence Inspector displays a clean "No Topic Selected" prompt rather than fake mock text.
  - Replaced hardcoded header fallbacks with generic project title fallbacks.

### Verification
- Ran vitest across `@groundq/api`, `@groundq/web`, and `@groundq/contracts` — all 36 tests passing (18 API, 14 Web, 4 Contracts).
- Ran TypeScript compilation (`pnpm run typecheck`) — 0 errors across all workspaces.
- Ran ESLint (`pnpm run lint`) — passed cleanly.
- Ran Prettier check (`pnpm run format:check`) — passed cleanly.
- Verified deterministic extraction on sample digital PDF with `pdf-parse` (46 extracted chars, 1 chunk created, 768-dim embedding generated via Ollama nomic-embed-text).

### Type
Bug Fix / UI / Architecture / Alignment / Verification

### Status
Implemented and verified locally.

### Changes
- Fixed initial mock state flicker and false fallback in [ProjectResourcesPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectResourcesPage.tsx):
  - Changed initial `resources` state from hardcoded `mockDemoResources` to empty array `[]`.
  - Changed initial `activeView` to correctly compute `'empty'` if 0 resources exist.
  - Rewrote `loadData()` as a reusable `useCallback` that queries live `/api/v1/projects/:projectId/resources` from Supabase.
  - Fixed the "Refresh resources" button: now executes `loadData()` to re-fetch live project data from the database instead of resetting to the 5 mock demo PDFs.
  - Fixed OCR scanned document alert banner: now checks exclusively whether any real resource in the project failed with a scanned/OCR failure reason (instead of checking `activeView === 'ocr_alert'`).
- Fixed mock demo fallback in [ProjectTopicsPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectTopicsPage.tsx):
  - Initial `modules` and resource counts now default to empty (`[]` and 0) for real projects.
  - Removed silent fallback that was overwriting real project state with `mockDemoModules` on error.
  - Provided explicit `initialModules` and `initialResources` props for unit test isolation while keeping production live and clean.
- Formatted, linted, and typechecked all workspaces.

### Verification
- Prettier check (`npx pnpm@9.15.5 run format:check`) — passed cleanly.
- ESLint (`npx pnpm@9.15.5 run lint`) — passed cleanly (0 errors, 0 warnings).
- TypeScript compilation (`npx pnpm@9.15.5 run typecheck`) — passed cleanly across all workspaces.
- Workspace unit tests (`npx pnpm@9.15.5 run test`) — 36/36 passed:
  - `@groundq/contracts`: 4/4 passed.
  - `@groundq/api`: 18/18 passed.
  - `@groundq/web`: 14/14 passed.

## [2026-10-12] — Academic Course Project Manager (/app) Stitch UI Implementation

### Type
Feature / UI / Integration / QA / Verification

### Status
Implemented and verified locally.

### Changes
- Fetched and extracted latest Stitch UI design (`ee63e19630b847c893021496504f590c`) for GroundQ Course Project Manager via the Google Stitch MCP interface (`get_screen`).
- Implemented high-density academic course manager in [WorkspacePage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/WorkspacePage.tsx):
  - Fixed top navigation bar with GroundQ logo, workspace breadcrumbs, live inference status indicator (`Local Ollama Inference: Online`), active faculty identity chip, and sign out button.
  - Academic telemetry strip: Active Projects count, Processed PDFs counter, Topics Extracted tally, and Grounding Integrity (100% Locked indicator).
  - Search & filter toolbar: Keyword filtering across course name and description, and toggle tabs between `Active Projects` and `Archived`.
  - Responsive 3-column project cards grid: Course badge, context menu with archive and direct navigation shortcuts, description synopsis, quantitative badges (`Grounded PDFs`, `Curriculum Topics`, `100% Grounded`), creation date, and primary `Open Workspace →` button linking into `/app/projects/:projectId/resources`.
  - Empty state: Clean folder vector illustration, quickstart 3-step guide (`Upload PDFs` -> `Extract Topics` -> `Synthesize`), and primary `Create Your First Project` action.
  - Centered Create Project Modal: Backdrop blur dialog with form controls for Course Title, Curriculum Scope/Description, Grounding Pipeline indicator, validation, and real-time Supabase project creation.
- Added comprehensive unit tests in [workspace.test.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/test/workspace.test.tsx).

### Verification
- Prettier check (`npx pnpm@9.15.5 run format:check`) — passed cleanly.
- ESLint (`npx pnpm@9.15.5 run lint`) — passed cleanly (0 errors, 0 warnings).
- TypeScript compilation (`npx pnpm@9.15.5 run typecheck`) — passed cleanly across contracts, api, and web.
- Workspace unit tests (`npx pnpm@9.15.5 run test`) — 36/36 passed:
  - `@groundq/contracts`: 4/4 passed.
  - `@groundq/api`: 18/18 passed.
  - `@groundq/web`: 14/14 passed.
- Production build (`npx pnpm@9.15.5 run build`) — succeeded cleanly.

## [2026-10-12] — Route Guards & Strict Authentication Lifecycle

### Type
Feature / Security / UI / Verification

### Status
Implemented and verified locally.

### Changes
- Created [AuthGuards.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/components/AuthGuards.tsx) containing:
  - `ProtectedRoute`: Verifies active Supabase session; redirects unauthenticated users to `/sign-in?redirectTo=<target>`. Subscribes to `onAuthStateChange` to respond dynamically.
  - `GuestRoute`: Redirects users who are already logged in away from `/sign-in`, `/sign-up`, and `/password-recovery` directly to `/app`.
- Applied route guards in [App.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/App.tsx):
  - Protected: `/app`, `/app/projects/:projectId/resources`, `/app/projects/:projectId/topics`.
  - Guest-only: `/sign-in`, `/sign-up`, `/password-recovery`.
- Hardened [ProjectResourcesPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectResourcesPage.tsx) and [ProjectTopicsPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectTopicsPage.tsx):
  - Replaced silent fallback on `UNAUTHENTICATED` with an immediate redirect to `/sign-in?redirectTo=...`.
  - Enforced session access token verification in `apiRequest` before executing calls.
- Updated [AuthPages.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/AuthPages.tsx) to honor `redirectTo` search parameter upon successful sign-in.

### Verification
- Prettier check (`npx pnpm@9.15.5 run format:check`) — passed cleanly.
- ESLint (`npx pnpm@9.15.5 run lint`) — passed cleanly (0 errors, 0 warnings).
- TypeScript compilation (`npx pnpm@9.15.5 run typecheck`) — passed cleanly across all workspaces.
- Unit tests (`npx pnpm@9.15.5 run test`) — 34/34 passed across contracts, api, and web.

## [2026-10-12] — Dynamic State Integration & Live Supabase Verification for Topics and Resources

### Type
Feature / UI / Database / QA / Verification

### Status
Implemented and verified locally.

### Changes
- Cleaned up top header chrome:
  - Removed confusing `"Context:"` pill in both [ProjectTopicsPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectTopicsPage.tsx) and [ProjectResourcesPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectResourcesPage.tsx).
  - Removed the mock manual "State Inspector" bar (`Normal`, `Add Topic Drawer`, `Empty State`, `Zero Resources Warning`).
  - Implemented dynamic workspace state determination based directly on live project data:
    - If ready processed resources == 0 -> automatically displays the "Zero Processed Resources Ingested" warning banner with a quick navigation link to `/resources`.
    - If ready processed resources > 0 and 0 topics mapped -> automatically renders the Empty State with deterministic extraction prompt.
    - If topics exist -> renders the full 2-level module hierarchy tree with the Evidence Inspector and live chunk metrics.
- Connected remote Supabase PostgreSQL schema:
  - Verified user execution of migrations `202610110001`, `202610110002`, and `202610110003` in Supabase SQL editor creating tables `resources`, `resource_processing_runs`, `resource_chunks`, `topics`, and `chunk_topics`.
- Resolved unit test assertions:
  - Fixed duplicate element matching in [resources.test.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/test/resources.test.tsx) caused by the dynamic OCR alert banner and table row.
  - Aligned [topics.test.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/test/topics.test.tsx) default module state.
- Formatted, linted, and typechecked all workspaces.

### Verification
- Prettier check (`npx pnpm@9.15.5 run format:check`) — passed cleanly.
- ESLint (`npx pnpm@9.15.5 run lint`) — passed cleanly (0 errors, 0 warnings).
- TypeScript compilation (`npx pnpm@9.15.5 run typecheck`) — passed cleanly across contracts, api, and web.
- Workspace unit tests (`npx pnpm@9.15.5 run test`) — 34/34 passed:
  - `@groundq/contracts`: 4/4 passed.
  - `@groundq/api`: 18/18 passed.
  - `@groundq/web`: 12/12 passed.
- Production build (`npx pnpm@9.15.5 run build`) — succeeded cleanly.

### Type
Feature / UI / AI / API / Database / Security / Contracts

### Status
Implemented and verified locally.

### Changes
- Implemented Google Stitch-designed operational UI for `/app/projects/:projectId/topics` in `@groundq/web`:
  - Project header, academic breadcrumbs, live pipeline telemetry cluster (`Active Corpus`, `Grounding Index 100% Locked`, `Mapped Chunks 360 Units`), and pipeline tabs (`Resources`, `Topics` active, `Generation`, `Question Bank`).
  - Interactive State Inspector switcher: Normal (Populated Tree + Inspector), Add Topic Drawer, Empty State (No Topics), and Zero Resources Warning banner.
  - Left column: 2-level hierarchical topic tree with collapsible parent Module cards, AI Inferred / User Defined badges, coverage %, and indented subtopic rows displaying locked chunk counts and fit %.
  - Right column: Topic Grounding Evidence Inspector with linked chunk metrics, zero hallucination indicator, blueprint target allocation, and verified cryptographic evidence cards with document citations, page numbers, and quote blocks.
  - Slide-over drawer for manual topic creation: form inputs for title, parent module, Bloom's pedagogical depth, primary corroborating source, and conceptual bounds assertions.
  - Real-time notification toasts for topic selection, inference progression, and mutation confirmations.
  - Bidirectional navigation between Resources workspace and Topics workspace.
- Created `@groundq/contracts` topic schemas:
  - `topicSourceSchema` (`INFERRED`, `USER_DEFINED`, `IMPORTED`), `chunkTopicSourceSchema` (`AUTO_INFERRED`, `USER_ASSIGNED`).
  - `topicSchema`, `topicWithSubtopicsSchema` with recursive 2-level structure and chunk counts.
  - `createTopicSchema`, `updateTopicSchema`, `reorderTopicsRequestSchema`, `inferTopicsRequestSchema`, and `chunkTopicEvidenceSchema`.
  - Re-exported under `@groundq/contracts`.
- Created Supabase migration `202610110003_topics_and_chunk_mappings.sql`:
  - `public.topics` table: UUID PK, `project_id`, self-FK `parent_id` (enforcing max 2 levels), `name`, `description`, `source`, `sort_order`, `is_active`, and soft-archive `archived_at`.
  - Case-insensitive unique index on `(project_id, parent_id, lower(trim(name)))` for active topics.
  - `public.chunk_topics` table: many-to-many relationship linking `resource_chunks` to `topics` with confidence and source tags.
  - Row Level Security (RLS) policies enforcing project ownership on both `topics` and `chunk_topics`.
- Implemented Express API routes under `/api/v1/projects/:projectId/topics` in `@groundq/api`:
  - `GET /`: returns assembled 2-level topic tree (Modules with nested Subtopics) with aggregated chunk counts.
  - `POST /`: creates topic or subtopic; enforces 2-level depth boundary (parent cannot have a parent).
  - `PATCH /:topicId`: updates name, description, parent, or sort order.
  - `POST /reorder`: bulk updates ordering positions and parent assignments.
  - `POST /:topicId/archive`: soft-archives topic and cascades soft-archival to child subtopics (archive-first lifecycle).
  - `POST /infer`: extracts topic tree from indexed resource chunks using local Ollama model (with deterministic structural fallback heuristics).
  - `GET /:topicId/evidence`: fetches mapped chunk quotes, page numbers, and resource provenance for citations.
- Added comprehensive unit tests:
  - `@groundq/api`: 9 route and inferencer service tests in `apps/api/test/topics.test.ts`.
  - `@groundq/web`: 5 component tests covering header, hierarchy tree, inspector, state switcher, and drawer in `apps/web/test/topics.test.tsx`.

- Hardened local Ollama fetch calls in `apps/api/src/services/topic-inferencer.ts` and `apps/api/src/services/resource-processor.ts` with explicit `AbortController` timeouts (2.5s) to guarantee fast deterministic fallback and prevent hanging test runs when local inference models are cold or loading.

### Verification
- Prettier check (`npx pnpm@9.15.5 format:check`) — passed cleanly.
- ESLint (`npx pnpm@9.15.5 lint`) — passed cleanly across all workspaces with 0 errors/warnings.
- TypeScript compilation (`npx pnpm@9.15.5 typecheck`) — passed cleanly across contracts, api, and web.
- Workspace unit tests (`npx pnpm@9.15.5 test`) — 35/35 passed across contracts, api, and web:
  - `@groundq/contracts`: 4/4 passed.
  - `@groundq/api`: 18/18 passed.
  - `@groundq/web`: 13/13 passed.
- Production build (`npx pnpm@9.15.5 build`) — succeeded cleanly.
- Runtime server verification:
  - API daemon started and verified on `http://localhost:3001` (`/api/v1/health` returned 200 `{"status":"ok","service":"groundq-api"}`).
  - Authenticated API route rejection verified (`/api/v1/projects` returned 401 unauthenticated).
  - Frontend Vite dev server started and verified on `http://localhost:5173` (HTTP 200).

## [2026-10-11] — Resource Ingestion Pipeline (Text Extraction, Chunking & Embeddings)

### Type
Feature / AI / Processing / Database / Architecture

### Status
Implemented and verified locally.

### Changes
- Pulled and configured `nomic-embed-text` (768 dimensions) via local Ollama for semantic chunk embeddings.
- Installed `pdf-parse` in `@groundq/api` for page-wise text extraction.
- Created migration `202610110002_resource_chunks.sql`:
  - `resource_chunks` table with `vector(768)` embedding column, foreign keys to resources, runs, and projects.
  - Page-level provenance fields (`page_number`, `token_count`, `chunk_index`).
  - Unique index guaranteeing chunk sequence within a processing run.
  - RLS policies enforcing project ownership.
- Implemented `apps/api/src/services/resource-processor.ts`:
  - Page-by-page text extraction (`extractPagesFromPdf`).
  - Automatic detection of image-only / scanned PDFs (less than 50 total characters or < 10 chars/page) flagging `FAILED` with "This PDF does not contain extractable text. OCR support is not available yet."
  - Overlapping page-bounded semantic chunking (`chunkPages`), maintaining `page_number` provenance for question evidence citations.
  - Asynchronous vector embedding generation (`getEmbedding`) via local Ollama.
  - Pipeline coordinator (`processResourcePipeline`) updating run stages (`DOWNLOADING_FILE` → `EXTRACTING_TEXT` → `CHUNKING` → `EMBEDDING` → `READY`).
- Wired in-process asynchronous pipeline trigger into `POST /api/v1/projects/:projectId/resources/:resourceId/process` and `reprocess`.

### Verification
- Prettier check (`pnpm format:check`) — passed.
- ESLint (`pnpm lint`) — passed with 0 warnings/errors.
- TypeScript compilation (`pnpm typecheck`) — passed across contracts, API, and web.
- Contracts unit tests (`pnpm --filter @groundq/contracts test`) — 4/4 passed.
- API tests (`pnpm --filter @groundq/api test`) — 9/9 passed, including new chunking and page provenance tests.
- Web unit/component tests (`pnpm --filter @groundq/web test`) — 8/8 passed.
- Playwright E2E suite (`pnpm test:e2e`) — 3/3 passed.
- Production build (`pnpm build`) — succeeded cleanly.

## [2026-10-11] — Project Resource Management Vertical Slice

### Type
Feature / UI / API / Database / Security / Contracts

### Status
Implemented and verified locally.

### Changes
- Implemented Google Stitch-designed operational UI for `/app/projects/:projectId/resources` in `@groundq/web`:
  - Project header, breadcrumb navigation, corpus telemetry (`Active Corpus: X / Y Ready`), and pipeline tabs (`Resources` active; `Topics`, `Generation`, `Question Bank` locked).
  - Search filter ribbon, classification dropdown (`STUDY_MATERIAL`, `PRESENTATION`, `PYQ`, `SYLLABUS`, `OTHER`), and lifecycle status dropdown (`READY`, `PROCESSING`, `READY_TO_PROCESS`, `FAILED`).
  - Dense operational table with all lifecycle states, interactive State Inspector switcher, and 4-step onboarding empty state.
  - PDF Upload dialog supporting drag-and-drop, 25 MB max size validation, client classification selector, and direct-to-storage staging.
  - Resource Inspector details drawer displaying SHA checksum, token anchor count, page count, storage path, error diagnostics, and run telemetry.
  - Dedicated unsupported scanned-PDF error mode: "This PDF does not contain extractable text. OCR parsing is disabled in local-first standard tier."
- Created `@groundq/contracts` resources schemas:
  - `resourceKindSchema`, `resourceStatusSchema` (including `READY_TO_PROCESS`), `resourceSchema`.
  - `uploadInitRequestSchema` (strictly enforcing PDF MIME type and 25 MB max limit) and `uploadInitResponseSchema`.
  - `finalizeResourceRequestSchema`, `resourceListQuerySchema`, `resourceListResponseSchema`.
  - `resourceProcessingRunSchema` and `resourceStatusResponseSchema`.
- Created Supabase migration `202610110001_resources_and_processing.sql`:
  - `resources` table with UUID PK, project/profile foreign keys, timestamps, and indexes.
  - `resource_processing_runs` table with audit trail, parser/chunking versioning, and status checks.
  - Supabase Storage bucket `resources` (private, 25 MB file size limit, `application/pdf` MIME type).
  - Row Level Security (RLS) policies enforcing project ownership on `resources`, `resource_processing_runs`, and `storage.objects`.
- Implemented Express API routes under `/api/v1/projects/:projectId/resources` in `@groundq/api`:
  - `POST /upload-init`: validates project ownership, generates server-side storage path (`resources/:projectId/:resourceId/:safeFilename`), stages `UPLOADING` record, and returns signed upload parameters.
  - `POST /`: finalizes upload, transitions status to `READY_TO_PROCESS`.
  - `GET /`: cursor-paginated resource listing scoped to project with status and type filters.
  - `GET /:resourceId`: retrieves individual resource metadata.
  - `GET /:resourceId/status`: retrieves resource status and most recent processing run.
  - `POST /:resourceId/process` and `POST /:resourceId/reprocess`: initiates/re-runs processing run.
  - `POST /:resourceId/archive`: soft-archives resource without hard deletion.
- Wired `ProjectResourcesPage` to live backend and Supabase Storage with graceful fallback for local development and testing.

### Verification
- Prettier check (`pnpm format:check`) — passed.
- ESLint (`pnpm lint`) — passed with 0 warnings/errors.
- TypeScript compilation (`pnpm typecheck`) — passed across contracts, API, and web.
- Contracts unit tests (`pnpm --filter @groundq/contracts test`) — 4/4 passed.
- API tests (`pnpm --filter @groundq/api test`) — 6/6 passed.
- Web unit/component tests (`pnpm --filter @groundq/web test`) — 8/8 passed.
- Playwright E2E suite (`pnpm test:e2e`) — 3/3 passed.
- Production build (`pnpm build`) — succeeded cleanly.

## [2026-10-11] — Deterministic Development Orchestration

### Type
Developer Experience / Configuration / Runtime Stability

### Status
Implemented and verified locally.

### Changes
- Added a root `dev:prepare` step that builds `@groundq/contracts` before starting the API and web processes.
- Added a cross-platform Node port preflight for the fixed API (`3001`) and web (`5173`) ports.
- Configured Vite with `strictPort: true` so it no longer silently moves to a port that conflicts with CORS and Supabase redirect configuration.
- Changed root scripts to call `pnpm` directly, allowing both Corepack shims and the documented `npm exec`/`npx` pinned pnpm fallback.
- Added an API startup warning when Supabase environment variables are missing.
- Documented startup, port-conflict, and package-manager fallback behavior in `README.md`.

### Verification
- Contracts build completed before dev processes started.
- API started on `http://localhost:3001`.
- Web started on `http://localhost:5173`.
- API health returned 200 and the web root returned 200.
- A duplicate startup attempt was rejected with a clear occupied-port message without terminating existing processes.
- Prettier, ESLint, all package typechecks, and all package tests passed.

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
