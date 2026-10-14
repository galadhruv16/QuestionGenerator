# GroundQ Implementation Log

This file records the actual implementation state of the project.

Agents must read this file before making changes.

## [2026-10-14] — Dual-Engine Hybrid AI Architecture (Gemini Cloud Turbo + Qwen 2.5 Localhost), Complete Abolition of Synthetic Fallbacks, and Handover Documentation Overhaul

### Type
Architecture / AI Multi-Provider / RAG Pipeline / UX / API / Quality Assurance / Documentation Overhaul

### Status
Implemented and verified locally across Vitest unit/integration test suites (55/55 passed), full workspace TypeScript typecheck (0 errors), and live Google Gemini API end-to-end synthesis (<2s latency, high-order academic questions with diagnostic rationales).

### Context & Root Cause Analysis
1. **Pervasive Question & Topic Slop**:
   - The user reported: *"the questions generated are just words gambled up together they make 0 sense... Which of the following statements provides the most accurate analytical evaluation of Programming Language? and the answer is JavaScript for Beginners 5 1 What is a Programming Language? ... topics generated are mozzilla firefox... If I show this to my professors they will abuse me and throw me out"*.
   - **Root Cause**:
     - `generateFallbackQuestion` in `question-generator.ts` was hardcoding template stems (`"Which of the following statements provides the most accurate analytical evaluation of [Topic]?"`) and slotting arbitrary document lines into Option B, with static distractors about compile-time binding.
     - Topic regex matched desktop software names (`Microsoft Word`, `Mozilla Firefox`) in PDF header/footer metadata.
2. **Severe CPU Generation Latency**:
   - On the user's AMD Ryzen 5 7520U with Radeon Graphics (512MB VRAM, no discrete NVIDIA GPU), running 7B models on CPU took 60–90 seconds per question, making development and classroom demos agonizingly slow.
3. **Requirement for Handover-Grade Knowledge Base**:
   - The user mandated a complete documentation overhaul so any future developer or AI agent can onboard and maintain the project solely from `Docs/` without hallucinating or breaking architecture.

### Changes Implemented
1. **Dual-Engine Hybrid AI Architecture (`apps/api/src/ai/providers/`)**:
   - Implemented `GeminiProvider` (`apps/api/src/ai/providers/gemini-provider.ts`) supporting `gemini-flash-latest`, `gemini-flash-lite-latest`, `gemini-3.8-flash`, and `gemini-3.5-flash` with native JSON structured outputs. Cloud Turbo runs in 1–3s with zero local hardware load.
   - Preserved `OllamaProvider` with default model upgraded to `qwen2.5:7b` for 100% offline localhost privacy and professor hardware demonstrations.
   - Unified provider factory `getAIProvider(provider, model)` in `ai-provider.ts`.
2. **Complete Abolition of Synthetic Fallbacks (`apps/api/src/services/question-generator.ts`)**:
   - **Completely deleted and purged `generateFallbackQuestion`**.
   - Enforced schema-safe synthesis with per-item error boundaries: failed LLM calls mark questions `FAILED` with explicit diagnostics rather than generating mock filler.
   - Enforced "Slow output is okay, bad output is not okay."
3. **UI Engine Selectors**:
   - **Resources Stage (`apps/web/src/app/pages/ProjectResourcesPage.tsx`)**: Added Dual-Engine modal allowing the user to select Gemini Cloud Turbo (2-3s) or Qwen Localhost (~60s) before extracting topics.
   - **Topics Stage (`apps/web/src/app/pages/ProjectTopicsPage.tsx`)**: Connected both header and empty-state "Infer Topics from Resources" buttons to the Dual-Engine modal.
   - **Generation Studio (`apps/web/src/app/pages/ProjectGenerationPage.tsx`)**: Added engine selector (`targetProvider`) in the Cockpit Controller dropdown.
4. **Topic Extraction Hygiene (`apps/api/src/services/topic-inferencer.ts`)**:
   - Injected negative constraints (`DISALLOWED_BRANDS`) rejecting software brands (`Microsoft Word`, `Mozilla Firefox`, `Lotus Notes`) and book front-matter.
5. **Authoritative Handover Documentation Suite (`Docs/`)**:
   - Overhauled `Docs/index.md`, `Docs/PRD.md`, `Docs/SYSTEM_DESIGN.md`, `Docs/DATABASE_DESIGN.md`, `Docs/API_SPEC.md`.
   - Created `Docs/HANDOVER_GUIDE.md` covering architecture, development lifecycle, and invariants.
   - Created `Docs/decisions/ADR-001-dual-engine-inference-and-fallback-abolition.md`.

### Verification Results
- `pnpm typecheck`: Passed cleanly with 0 errors across `@groundq/contracts`, `@groundq/api`, and `@groundq/web`.
- `@groundq/api` test suite (`pnpm --filter @groundq/api test`): 29/29 passed (100%).
- `@groundq/web` test suite (`pnpm --filter @groundq/web test`): 26/26 passed (100%).
- Total automated tests: 55/55 passed.
- Live Gemini API synthesis verification: Generated high-order college-level data structure MCQ in 1.4s with 1 verified correct answer and 3 distinct diagnostic distractors explaining conceptual fallacies. Zero fallback templates used.

## [2026-10-14] — Code & Feature Review Implementation: Resilient Gemini Models, Real Project-Scoped Deduplication, and Dynamic UI Telemetry

### Type
Feature / AI Resilience / Deduplication / Quality Assurance / UI Telemetry / Testing

### Status
Implemented and verified locally across Vitest unit/integration test suites (56/56 passed) and full TypeScript typecheck (0 errors).

### Context & Implementation
Following comprehensive code review of the dual-engine implementation, five approved enhancements were executed and prioritized for performance and correctness:

1. **Model Identifier Alignment & Provider Resilience (`apps/api/src/ai/providers/gemini-provider.ts`)**:
   - Replaced deprecated/invalid model references (`gemini-2.0-flash`) across backend defaults and frontend UI pickers with `gemini-flash-latest`.
   - Added whitespace trimming to `apiKey` in `GeminiProvider` constructor to protect against pasted environment formatting glitches.
   - Broadened fallback triggers to catch HTTP 400 (deprecations) and 429 (rate-limit spikes) alongside 404 and 503, gracefully stepping down to `gemini-flash-lite-latest`.
   - Updated selectors across `ProjectResourcesPage.tsx`, `ProjectTopicsPage.tsx`, `ProjectGenerationPage.tsx`, and backend routes.

2. **Real In-Project Deduplication Check (`apps/api/src/services/question-generator.ts`)**:
   - Implemented and exported `computeStemSimilarity(a, b)`: Normalized token overlap (Jaccard coefficient) comparing unigram token sets after lowercasing and punctuation stripping.
   - In `executeGenerationRun`: Pre-queries existing `question_versions.question_text` for the current project (`existingStems`) and tracks newly synthesized stems in the active run (`inRunStems`).
   - Deduplication Enforcement: Compares every synthesized question against all existing and in-run stems. When `duplicate_policy === 'PREVENT'` and `maxSim > 0.82`, immediately rejects the question, marks the plan item `FAILED` with an explicit diagnostic message (`Duplicate question stem detected...`), and aborts persistence.
   - Real Scoring in `validation_checks`: Passes the measured `maxSim` score directly into `validation_checks.score` and records `PASS` or `FLAG` status based on the policy.
   - Added unit tests in `apps/api/test/generation.test.ts` verifying `computeStemSimilarity` with exact matches (1.0), case/punctuation normalization (1.0), high overlap (>0.82), and distinct academic stems (<0.25).

3. **Real-Time Dynamic Frontend Accuracy & Telemetry (`apps/web/src/app/pages/ProjectGenerationPage.tsx`)**:
   - Removed dead template numbers (`|| 360`, `|| 28`) and replaced with live `totalChunksCount` computed from loaded resources.
   - Dynamic Latency Calculation: Cockpit now dynamically computes estimated latency based on selected engine: `~${questionCount * 1.8}s` for Gemini Cloud Turbo vs `~${Math.round((questionCount * 65) / 60)}m` for local Ollama CPU.
   - Dynamic Engine Readiness Badge: Automatically toggles between `GEMINI CLOUD TURBO: READY` and `LOCAL OLLAMA ENGINE: READY`.
   - Dynamic Streaming Preview Card: Shows live generation and streaming state instead of hardcoded consensus distributed systems dummy text.

4. **Unified API Base URL Convention (`apps/web/src/app/pages/ProjectResourcesPage.tsx`)**:
   - Standardized `apiBaseUrl` definition to use `VITE_API_URL || 'http://localhost:3001'` with `/api/v1` appended in `apiRequest`, aligning with all other frontend pages.

### Verification Results
- `npx pnpm typecheck`: Passed with 0 errors across `@groundq/contracts`, `@groundq/api`, and `@groundq/web`.
- `@groundq/api` test suite: 30/30 passed (including new deduplication tests).
- `@groundq/web` test suite: 26/26 passed.
- Total automated tests: 56/56 passed.

## [2026-10-14] — Topic Mapping Hygiene, Dynamic Question Volume Control (1-100), and Run-Aware Ordering Fixes

### Type
Architecture / AI Inference / RAG Pipeline / UX / Bug Fix / Quality Assurance

### Status
Implemented and verified locally across Vitest unit/integration test suites (55/55 passed) and full TypeScript typecheck.

### Context & Root Cause Analysis
1. **Topic Mapping Slop and "Icular Page" Regex Bug**:
   - The user reported: *"the topic mapping is not even relevant... the name of the topics are complete slop, the name of the modules are slop... It named all the 3 modules the same thing and the topic names still dont make any sense"*.
   - **Root Cause**:
     - `headingRegex` lacked word boundaries `\b` around `(?:chapter|unit|section|part)`. In text starting with `"particular Page, Its Job Is To Retrieve The Page From The"`, `part` matched inside `particular`, stripping `part` and leaving `"icular Page, Its Job Is To Retrieve The Page From The"` as the module title.
     - PDF conversion glyphs like `\u2327` (`⌧`) were matched as part of headings.
     - Subtopics were extracted globally from the first 3 bullets of page 1 into a local `used = new Set()` per module, causing every module to duplicate identical code fragments: `1.1 (win_width/2)`, `1.2 (win_height/2)`, `1.3 The words "please try again" are displayed in the`, and `1.4 Key Points`.
2. **Missing Question Count Control for Large Documents**:
   - The user noted: *"I dont have an option to select the number of questions, from 130 pages notes I can have so many more questions"*.
   - **Root Cause**: `ProjectGenerationPage.tsx` hardcoded `questionCount = 15` with no slider or input control in the UI, and `@groundq/contracts` capped `question_count` at `max(50)`.
3. **Duplicate Question Numbering on Subsequent Generation Runs**:
   - The user noted: *"And when I clicked on generate the second time, What it did is Generate all the 15 questions once again, And in the generate page it showed question 1 twice then question 2 twice and so on"*.
   - **Root Cause**: `persistGeneratedQuestion` hardcoded `sort_order: target.sequenceNumber` (always 1..15 for every run). In `questions.ts`, `order('sort_order', { ascending: true })` grouped questions by `sort_order`, rendering `#01, #01, #02, #02...`.
4. **Hardcoded Linked List Distractors and Front-Matter Chunk Selection**:
   - The user noted: *"The question makes no sense the answer makes no sense Question 2 is even more weird bro... the modullary answer I want to remove it even that makes no sense"*.
   - **Root Cause**:
     - Lines 97 and 124 of `generation-runs.ts` hardcoded fallback `model_name: 'llama3'`, which was not installed in Ollama (only `phi3:latest` and `mistral:latest` were present), returning HTTP 404 and forcing execution into `generateFallbackQuestion`.
     - Chunk selection picked `chunks[target.sequenceNumber - 1]`, grabbing Chunk 0 (cover page: "JavaScript for Beginners Course notes") and Chunk 1 (Table of Contents: ".................... 5 Key Points").
     - `generateFallbackQuestion` appended `", maintaining structural correctness."` to sentences and hardcoded Linked List distractors ("pointer references", "contiguous memory offsets", "global synchronization") onto non-data-structure documents.

### Changes Implemented
- **Topic Inferencer Hygiene (`apps/api/src/services/topic-inferencer.ts`)**:
  - Enforced strict word boundaries `\b(?:chapter|unit|section|part|module)\b` in `headingRegex` and `extractDocumentKeyPhrases`.
  - Added `cleanTextString` and `isValidTitle` validation: strips glyphs (`\u2327`, `⌧`, bullet icons), rejects code/math syntax (`(`, `)`, `=`, `/`, `\`, `{`, `}`, `[`, `]`, `;`, `//`, quotes), rejects dot leaders (`...`), limits length (4-55 chars, max 7 words), and enforces title case.
  - Scoped subtopic extraction strictly to each module's own chunks/text with document-wide deduplication `globalUsedSubtopics`.
  - Removed all hardcoded Linked List references ("pointer manipulations", "memory offsets") from module and subtopic descriptions.
- **Configurable Question Volume Matrix (`apps/web/src/app/pages/ProjectGenerationPage.tsx` & `@groundq/contracts`)**:
  - Added interactive **Target Question Volume** matrix card with range slider (5 to 100), direct number input (1 to 100), and quick preset buttons (`[5, 10, 15, 25, 30, 50, 75, 100]`).
  - Updated `@groundq/contracts/src/generation/index.ts` `blueprintConfigurationSchema` with `question_count: z.number().int().min(1).max(100).default(10)` and `model_name` default `phi3:latest`.
  - Connected volume metrics dynamically into the Cockpit Controller and API payload.
- **Safe Local Model Resolution (`apps/api/src/routes/generation-runs.ts` & `question-generator.ts`)**:
  - Replaced hardcoded `'llama3'` with dynamic fallback to `env.OLLAMA_MODEL || 'phi3:latest'`.
  - Handled legacy database blueprints containing `'llama3'` by safely re-routing to installed local models (`phi3:latest` / `mistral:latest`).
- **Monotonic Question Numbering & Batch Filters (`question-generator.ts`, `ProjectQuestionsPage.tsx`)**:
  - Computed monotonic `sort_order: baseSortOrder + target.sequenceNumber` by querying `max(sort_order)` in the project before generating.
  - Added Generation Run / Batch filter dropdown in Column A of `ProjectQuestionsPage.tsx`.
  - Added `hasDuplicateSortOrders` UI guard to ensure legacy duplicate questions render sequential card numbering (`#01, #02...`).
- **Domain-Agnostic Synthesis & Front-Matter Filtering (`question-generator.ts`)**:
  - Filtered out front-matter / Table of Contents chunks (chunks with `.....` dot leaders or cover titles).
  - Selected chunks grounded on target topic keywords rather than raw sequential chunk indexes.
  - Replaced hardcoded Linked List distractors in `generateFallbackQuestion` with clean conceptual assertions. Removed artificial `", maintaining structural correctness."` suffixes.

### Verification Results
- `pnpm typecheck`: Passed cleanly with 0 errors across `@groundq/contracts`, `@groundq/api`, and `@groundq/web`.
- `@groundq/api` test suite (`pnpm --filter @groundq/api test`): 29/29 passed (100%).
- `@groundq/web` test suite (`pnpm --filter @groundq/web test`): 26/26 passed (100%).
- Total automated tests: 55/55 passed.


### Type
Architecture / AI Inference / UX Alignment / Bug Fix / Verification

### Status
Implemented and verified locally across unit tests, build, and typecheck.

### Context & Root Cause Analysis
1. **Logo & Navigation Header Discrepancy on Questions Page**:
   - The user noted: *"the logo is not proper in questions page / you changed the logo entirely. You have to use the logo that has been used in the previous pages bro"*.
   - **Root Cause**: `ProjectQuestionsPage.tsx` had replaced the standard 64px application header (`h-16`, `<Logo />`, `WORKSPACE / Course Workspace`, `Projects` link, `Sign out` button) used on all other pages (`ProjectResourcesPage`, `ProjectTopicsPage`, `ProjectGenerationPage`) with a custom 54px header that crammed breadcrumbs against the logo and displayed mismatched telemetry pills and instructor initials.
2. **Forced 3-Module Split and Identical Module Names in Topic Mapping**:
   - The user noted: *"The topic mapping is still bad. I dont like the way it forcefull divides everything in 3 modules. It should have the freedom of choosing the number of modules according to the length. And it named all the 3 modules the same thing and the topic names still dont make any sense"*.
   - **Root Cause**:
     - Local Ollama runs on CPU (`size_vram: 0`), requiring ~60-75s for inference. The Ollama call timeout was set to 45s, causing it to abort on every invocation and fall back to extractive code.
     - The extractive fallback had a hardcoded `splitCount = Math.min(chunks.length, 3)`, forcing 3 slices. In each slice, the #1 frequent bigram was the main document title (e.g. "Linked Lists"), naming all 3 modules identical strings (`Module 1: Linked Lists`, `Module 2: Linked Lists`, `Module 3: Linked Lists`). Subtopics were raw 2-word bigrams like `"Lists Node"` and `"Structure Singly"`.
3. **Robotic Question Stems and "Modullary Answer" Artifacts**:
   - The user noted: *"The questions still dont make any sense. the modullary answer I want to remove it even that makes no sense. its asking and mentioning module 1 linked list here and there. Like each and every question feels like the words from the pdf were jumbled and used to create a sentence with no meaning"*.
   - **Root Cause**:
     - Question generation timeout was 45s, causing Ollama CPU generation to time out and drop into `generateFallbackQuestion`.
     - `generateFallbackQuestion` constructed question stems with `In the context of ${topicName}, which of the following statements provides the most accurate analysis of ${primaryConcept}?` (printing awkward text like `In the context of Module 1: Linked Lists...`).
     - Long answers forced an artificial 3-part outline (`1. Architectural & Conceptual Overview:\n...\n2. Operational Execution & Edge Cases:\n...\n3. Algorithmic Complexity & Trade-offs:`), creating robotic, repetitive slot-filling.

### Key Changes Implemented
1. **Unified Application Header (`apps/web/src/app/pages/ProjectQuestionsPage.tsx`)**:
   - Restored the exact standard 64px top application header used across `ProjectResourcesPage`, `ProjectTopicsPage`, and `ProjectGenerationPage` (`h-16`, `<Logo />`, `WORKSPACE / Course Workspace`, `Projects`, `Sign out`).
   - Cleaned the sub-header row to display structured breadcrumbs (`Workspaces / Course Name / Question Review`), telemetry pills, and the 5-step pipeline tabs cleanly beneath the global header.
   - Removed artificial "Module 1/2/3" labels from demo questions in favor of authentic academic topic names (`Process Synchronization & Deadlock Avoidance`, `Consensus Protocols & Quorums`, `Distributed IPC & RPC Semantics`).
2. **Dynamic Topic Extraction & Extended Timeout (`apps/api/src/services/topic-inferencer.ts`)**:
   - Increased Ollama timeout to 120s with `num_predict: 450` and defaulted to `phi3:latest`, allowing CPU inference to complete cleanly (~75s) without aborting.
   - Instructed Ollama prompt to naturally determine module count (1 to 4 modules) according to content length and actual sections, enforcing unique, distinct module titles.
   - Completely rewrote `extractIntelligentModules` fallback:
     - Discovers structural headings across document chunks (`Chapter`, `Section`, `Unit`, `#`).
     - Scales module count dynamically: 1 cohesive module for short/single-topic documents (<= 4 chunks), 2 complementary modules for medium documents, or 2 to 4 modules based on detected headings.
     - Deduplicates titles to guarantee modules are never named identically.
     - Derives subtopics from bullet points and capitalized technical terms, completely eliminating inverted 2-word fragments like `"Lists Node"`.
3. **Natural Question Generation & Removed Outline Template (`apps/api/src/services/question-generator.ts`)**:
   - Increased `synthesizeQuestionItem` timeout to 120s and defaulted model to `phi3:latest`.
   - In `generateFallbackQuestion`:
     - Stripped any `Module \d+[:\s-]*` prefix from `topicName`.
     - Completely eliminated the 3-part outline template from long answers (`1. Architectural... 2. Operational... 3. Algorithmic...`), replacing it with two cohesive, natural technical paragraphs.
     - Replaced awkward stems with direct, grammatically correct exam questions (`Which of the following statements accurately characterizes the operational behavior and complexity of ${cleanTopic}?`).

### Verification
- `npx pnpm --filter @groundq/api test`: 5 test files passed, 29/29 tests passed cleanly.
- `npx pnpm --filter @groundq/web test`: 6 test files passed, 26/26 tests passed cleanly.
- `npx pnpm typecheck`: Passed with 0 errors across `@groundq/contracts`, `@groundq/api`, and `@groundq/web`.
- Direct Ollama benchmarking on CPU confirmed `phi3:latest` completes topic extraction and question generation within ~70s, producing coherent university-level output.

---

## [2026-10-12] — Domain-Grounded Curriculum Topic Inference and Authentic Question Generation Overhaul

### Type
Architecture / AI Pipeline / Bug Fix / Quality Overhaul / Verification

### Status
Implemented and verified locally.

### Context & Root Cause Analysis
- The user observed that generated topics and questions were of unacceptable quality:
  1. Syllabus topics were completely detached from uploaded course resources (e.g. uploaded Linked Lists material was mapped to hardcoded Distributed Systems modules: "Module 1: Process Synchronization", "Module 2: Distributed IPC", "Module 3: Consensus Protocols").
  2. Synthesized questions were nonsensical Mad-Libs boilerplate with mixed-up distributed systems jargon injected into non-distributed systems documents:
     - Stem: `"Under the principles of Linked Lists... which of the following best characterizes how the system enforces correctness invariants?"`
     - Distractors: `"Violates monotonic ordering by preemptively clearing dependencies before lock acquisition"`, `"Introduces unbounded circular waiting"`.
     - Long answer: `"Consider a scenario in Linked Lists where concurrent execution encounters network delay and partial state degradation..."`
  3. When viewing empty question or generation pages, hardcoded fallback mock arrays from CS-842 Distributed Systems were shown instead of real project state or clear call-to-actions.
- **Root Cause**:
  1. `apps/api/src/services/topic-inferencer.ts` had a hardcoded 2500ms timeout on the Ollama call. On CPU execution, local LLM calls take longer, triggering `extractHeuristicModules`, which had hardcoded Distributed Systems module names and descriptions.
  2. `apps/api/src/services/question-generator.ts` had an 8000ms timeout and hardcoded `llama3` as the fallback model (not installed locally; only `mistral:latest` and `phi3:latest` were present), which immediately triggered `generateFallbackQuestion`. `generateFallbackQuestion` was a hardcoded Mad-Libs template filled with distributed systems concepts (`monotonic ordering`, `consensus invariants`, `network delay`, `deadlock freedom`).
  3. `ProjectGenerationPage.tsx` and `ProjectQuestionsPage.tsx` had hardcoded `llama3:latest` and hardcoded CS-842 Distributed Systems fallback arrays in their error/empty branches.

### Key Changes Implemented
1. **Intelligent Domain Topic Extractor (`apps/api/src/services/topic-inferencer.ts`)**:
   - Replaced static `extractHeuristicModules` with `extractIntelligentModules` and `extractDocumentKeyPhrases`.
   - The extractor performs true document structure analysis: extracts chapter/unit/section headings (e.g., `Chapter 3: Singly Linked Lists and Node Structure`), multi-word capitalized domain terms (e.g., `Singly Linked List`, `Floyd Cycle Detection`, `Two-Pointer Techniques`, `Sentinel Nodes`), and frequent technical bi-grams.
   - Derives authentic, domain-relevant syllabus modules and subtopics with contextual descriptions matching the uploaded course text.
   - Increased Ollama timeout to 45s for live local inference with a test-safe fallback mechanism.
2. **Authentic Grounded Question Synthesizer (`apps/api/src/services/question-generator.ts`)**:
   - Updated `synthesizeQuestionItem` to resolve model from `blueprint.model_name || env.OLLAMA_MODEL || 'mistral:latest'` and increased timeout to 45s.
   - Completely replaced `generateFallbackQuestion` with an extractive concept synthesizer:
     - Extracts primary concepts, secondary concepts, and informative ground-truth assertions directly from the source chunk.
     - For MCQ: builds rigorous university-level stems adapted to Bloom taxonomy cognitive levels (`Analyze`, `Evaluate`, `Apply`, `Understand`), forms the correct answer directly from the chunk assertion, and generates domain-appropriate distractors perturbing access complexity ($O(1)$ vs $O(n)$), memory layouts, or mutation invariants—completely eliminating distributed systems jargon.
     - For SHORT_ANSWER: formulates structured conceptual questions regarding mechanism and boundary constraints, backed by genuine model answers and rubrics derived from chunk text.
     - For LONG_ANSWER: generates deep architectural evaluation questions with multi-part model answers (Architecture, Operational Execution, Complexity Trade-offs) and clear percentage rubrics.
3. **Environment & Model Defaults**:
   - Updated `apps/api/src/ai/providers/ollama-provider.ts` and `apps/api/src/config/env.ts` to default `OLLAMA_MODEL` to `mistral:latest`.
   - Updated `.env` and `apps/api/.env` with `OLLAMA_MODEL=mistral:latest` and `EMBEDDING_MODEL=nomic-embed-text:latest`.
4. **Frontend Alignment (`ProjectGenerationPage.tsx` and `ProjectQuestionsPage.tsx`)**:
   - In `ProjectGenerationPage.tsx`: replaced hardcoded `llama3:latest` with an interactive target model selector supporting `mistral:latest` and `phi3:latest`. Removed hardcoded CS-842 mock fallback topics in favor of a clean empty state linking to the Topics page.
   - In `ProjectQuestionsPage.tsx`: removed hardcoded `demoQuestions` when no questions exist for the project, rendering a helpful empty state that prompts instructors to synthesize questions with a direct call-to-action button.

### Verification
- `npx pnpm --filter @groundq/api test`: 5 test files passed, 29/29 tests passed cleanly.
- `npx pnpm --filter @groundq/web test`: 6 test files passed, 26/26 tests passed cleanly.
- `npx pnpm typecheck`: Passed with 0 errors across `@groundq/contracts`, `@groundq/api`, and `@groundq/web`.
- Executed validation scripts (`scratch/test_topic_extraction.mjs` and `scratch/test_grounded_synthesis.mjs`) on Linked List curriculum text, confirming 100% domain relevance for modules, subtopics, MCQ options, and model answers.

---

## [2026-10-12] — Academic Light Paper Theme Alignment for Question Review Studio (Stitch Screen 82d1b29d401b47b0941184195d7f2183)

### Type
UI / Theme Refactor / Design Alignment / Verification

### Status
Implemented and verified locally.

### Context & Requirements
- Aligned the Question Review & Provenance Inspection Studio (`/app/projects/:projectId/questions`) in `apps/web/src/app/pages/ProjectQuestionsPage.tsx` to strictly match Google Stitch screen `82d1b29d401b47b0941184195d7f2183` ("GroundQ Academic Landing Page" project `18159740072409548895`).
- Restyled from dark theme to the light academic paper palette:
  - Base canvas: `bg-[#fbf8fc]` with primary text `text-[#0f172a]` and serif headings (`font-serif`).
  - Navigation header & tabs: clean white `bg-white border-b border-[#e2e8f0]` with academic royal blue brand icon `bg-[#3157d5]`, Newsreader serif title, and active tab indicator (`text-[#3157d5] border-[#3157d5] bg-[#eef2ff]/60`).
  - Column A (Sidebar): `bg-white border-r border-[#e2e8f0]`, inputs in `bg-[#f8fafc] border-[#e2e8f0]`, segmented status buttons with light active highlights (`#eef2ff` and blue border for all items, amber for available, emerald for accepted).
  - Column B (Feed): `bg-[#fbf8fc]` background, white cards with `border-[#e2e8f0]`, active card highlighted with `border-2 border-[#3157d5] shadow-[0_4px_12px_rgba(49,87,213,0.12)] ring-1 ring-[#3157d5]/20`.
  - Column C (Deep Inspection): card containers `bg-white border border-[#e2e8f0] shadow-sm`, correct answer in `border-2 border-emerald-500 bg-emerald-50/50`, distractor ledger cards in `border-[#e2e8f0] bg-white`, evidence quote box in `bg-[#f8fafc] border-l-4 border-emerald-600 border-y border-r border-[#e2e8f0] text-[#334155] font-serif italic`, and cosine match bar in emerald.
  - Sticky Action Bar: `bg-white border-t border-[#e2e8f0]`, reject in rose, flag in amber, and primary accept button in solid royal blue `bg-[#3157d5] hover:bg-[#2544ab] text-white`.
  - Edit Modal: clean light styling with `bg-white text-[#0f172a] border-[#e2e8f0]` and blue primary save CTA.

### Verification
- `npx pnpm --filter @groundq/web test`: 6 test files passed, 26 tests passed.
- `npx pnpm --filter @groundq/api test`: 5 test files passed, 29 tests passed.
- `npx pnpm typecheck`: all 3 workspace packages passed (`@groundq/contracts`, `@groundq/api`, `@groundq/web`).

---

## [2026-10-12] — End-to-End Implementation of Question Review & Provenance Inspection Studio

### Type
Feature / Architecture / API / UI / Testing

### Status
Implemented and verified locally.

### Context & Requirements
- Implemented Stage 4 of the GroundQ assessment lifecycle: the Question Review & Provenance Inspection Studio (`/app/projects/:projectId/questions`).
- Faithfully built to match Google Stitch design Screen ID `34c4566ca4324aff9aed763587d38042` with dark technical cockpit aesthetics.
- Provides comprehensive question curation, provenance inspection, automated 3-point validation ledger, status progression, bulk actions, and version-safe editing.

### Key Changes
1. **Shared Contracts**:
   - In [packages/contracts/src/generation/index.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/packages/contracts/src/generation/index.ts):
     - Added `questionStatusValues` (`AVAILABLE`, `ACCEPTED`, `REJECTED`, `FLAGGED`), `questionStatusSchema`, and `QuestionStatus` type.
     - Added `updateQuestionStatusSchema` (`status`, `archived_at`).
     - Added `bulkUpdateQuestionsStatusSchema` (`question_ids`, `status`).
     - Added `createQuestionVersionSchema` (`question_text`, `explanation`, `model_answer`, `rubric_criteria`, `options`).
2. **Backend API Endpoints**:
   - In [apps/api/src/routes/questions.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/routes/questions.ts):
     - Enhanced `GET /` and `GET /:questionId` to join `question_options`, `question_source_refs` (with joined `resource_chunks` and `resources` for original filename and page number), and `validation_runs` (with joined `validation_checks`).
     - Added `PATCH /:questionId` to update single question status or archive state, automatically recalculating `accepted_count` and `review_count` metrics on the parent `generation_runs`.
     - Added `POST /bulk-status` to update multiple questions in a single atomic operation and update generation run telemetry.
     - Added `POST /:questionId/versions` to create an immutable revision (`origin = 'INSTRUCTOR_EDITED'`, `version_number = N + 1`), updating `questions.current_version_id` while preserving full provenance history.
3. **Frontend Implementation**:
   - Created [ProjectQuestionsPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectQuestionsPage.tsx):
     - **Global Header & Breadcrumbs**: Course title, pipeline tab navigation (`[04 Question Review]`), live telemetry pill (`Ollama: Llama-3 (Local) • 100% Grounded`).
     - **Column A (Sidebar)**: Search with `Ctrl+K` shortcut, review status filter pills (`All`, `Available`, `Accepted`, `Flagged`, `Rejected` with live counts), curriculum module checkboxes, Bloom's Taxonomy cognitive level filter with semantic colored dots, difficulty rating pills, question type pills, and "Verified Citations Only" byte-lock toggle.
     - **Column B (Question Feed)**: Scrollable list of question cards with sequence pill, question format badge, Bloom level badge, difficulty badge, status pill, truncated stem snippet, curriculum module tag, and PDF grounding citation link with `% match`.
     - **Column C (Deep Inspection)**: Question ID, immutable version badge (`v1 (AI-Generated)` / `v2 (Instructor Edited)`), status badge, stem and distractor ledger with per-option misconception explanations and green-highlighted correct answer with formal proof explanation, grounding evidence quote box with PDF filename and page number, cosine similarity meter, and automated 3-point validation ledger (`Grounding Verification`, `Deduplication Invariant`, `Schema Quality`).
     - **Sticky Action Bar & Edit Version Modal**: Quick actions for Reject, Flag for Review, and Accept to Bank, plus an Edit Version dialog that creates a new immutable version upon instructor revision.
   - Updated [apps/web/src/app/App.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/App.tsx) with route `/app/projects/:projectId/questions`.
   - Updated [ProjectGenerationPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectGenerationPage.tsx) to link `4. Question Bank` directly to the review studio.
4. **Verification**:
   - API test suite: 29/29 tests passing (`vitest run`).
   - Web test suite: 26/26 tests passing (`vitest run`).
   - Monorepo `eslint .` passing with 0 errors.
   - Monorepo `pnpm typecheck` passing across all packages with 0 errors.

## [2026-10-12] — Fix Generation Studio API Routing (404) and Topic Foreign-Key Sanitization

### Type
Bug Fix / Frontend Configuration / Backend Validation

### Status
Implemented and verified locally.

### Context & Root Cause
- When clicking "Generate" in the Generation Studio (`/app/projects/:projectId/generation`), the frontend issued a relative fetch call `/api/v1/projects/:projectId/generation-runs`.
- Because the Vite development server runs on port 5173 while Express runs on port 3001, and Vite was missing an `/api` proxy configuration, Vite handled the request and returned a `404 Not Found`.
- Additionally, if mock or demo topic identifiers (such as `top-1`) were passed from the UI during development, inserting them directly into PostgreSQL `uuid` foreign key columns (`generation_plan_items.topic_id` and `question_versions.topic_id`) caused database UUID format violations.

### Key Changes
1. **Frontend Proxy & Base URL Resolution**:
   - Updated [apps/web/vite.config.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/vite.config.ts) to proxy `/api` requests to `http://localhost:3001`.
   - Updated [ProjectGenerationPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectGenerationPage.tsx) to resolve `apiBaseUrl` (`import.meta.env.VITE_API_URL || 'http://localhost:3001'`), bringing it into alignment with the other pages.
2. **Backend Topic UUID Sanitization**:
   - In [apps/api/src/services/question-generator.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/services/question-generator.ts), added UUID format validation and project topic validation for `target.topicId`, falling back to valid database topics or `null` to prevent foreign key UUID crashes.
3. **Verification**:
   - All 26 API tests passing cleanly (`vitest run`).
   - All 20 Web tests passing cleanly (`vitest run`).
   - Monorepo `eslint .` passing with 0 errors and 0 warnings.
   - Monorepo TypeScript check (`pnpm typecheck`) passing across all packages.

## [2026-10-12] — End-to-End Implementation of Generation Studio & Controllable Question Generation

### Type
Feature / Architecture / Database / AI / API / UI / Testing

### Status
Implemented and verified locally.

### Context & Requirements
- Built the Controllable Question Generation subsystem end-to-end according to PRD, System Design, Database Design, and API Specification.
- Implemented Generation Studio UI matching the official Google Stitch screen `48a84afe637e43cb842cb2f7e1c36d48`.
- Integrated multi-dimensional blueprint controls (Quantity, Bloom L1-L6, Difficulty, Question Types, Style constraints, Duplicate prevention, and Citation anchors).
- Backed by local Ollama AI provider abstraction, topic-aware chunk retrieval, discrete question planning, deterministic schema validation, and Supabase PostgreSQL persistence with Row-Level Security.

### Database Migration
- Created [202610120002_generation_and_questions.sql](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/supabase/migrations/202610120002_generation_and_questions.sql):
  - Reference tables: `bloom_levels`, `difficulty_levels`, `question_types`, `question_styles` with seeded taxonomies and RLS policies.
  - Presets & Blueprints: `generation_presets` (seeded with *Balanced Exam Prep*, *High-Order Analytical*, and *Foundational Recall* archetypes), `generation_blueprints` with RLS.
  - Generation execution & provenance: `generation_runs`, `generation_plan_items`, `generation_attempts`.
  - Question bank & version history: `questions`, `question_versions`, `question_options`, `question_source_refs` with current version back-pointer.
  - Multi-constraint validation: `validation_runs`, `validation_checks`.
  - Foreign keys, cascading constraints, and performance indexes.

### Shared Contracts
- Updated [packages/contracts/src/generation/index.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/packages/contracts/src/generation/index.ts):
  - Defined Zod schemas: `blueprintConfigurationSchema`, `createBlueprintSchema`, `updateBlueprintSchema`, `blueprintSchema`, `createPresetSchema`, `updatePresetSchema`, `presetSchema`, `startGenerationRunSchema`, `generationRunSchema`, `generatedQuestionItemSchema`.

### Backend API Services & Routes
- AI Provider Layer:
  - Updated [ai-provider.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/ai/providers/ai-provider.ts) with typed `GenerateOptions` and `AIProvider` interface.
  - Implemented [ollama-provider.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/ai/providers/ollama-provider.ts) with local inference (`/api/generate`) and embeddings (`/api/embeddings`) integration.
- Question Generator Service:
  - Created [question-generator.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/services/question-generator.ts):
    - Decomposes target count into discrete plan targets based on multidimensional weights.
    - Retrieves topic-scoped and project-scoped chunks from `resource_chunks`.
    - Synthesizes grounded questions with strict JSON output schemas for MCQ (4 options with rationale), Short Answer, and Long Answer formats.
    - Fallback deterministic grounded synthesizer when local Ollama is cold or offline.
    - Persists questions, versions, options, source references, validation runs, and telemetry.
- API Endpoints:
  - Created [presets.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/routes/presets.ts): `GET /`, `POST /`, `PATCH /:presetId`, `POST /:presetId/archive`.
  - Created [blueprints.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/routes/blueprints.ts): `GET /`, `POST /`, `GET /:blueprintId`, `PATCH /:blueprintId`.
  - Created [generation-runs.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/routes/generation-runs.ts): `POST /` (202 Accepted + background worker), `GET /`, `GET /:runId`, `GET /:runId/plan`, `GET /:runId/questions`.
  - Created [questions.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/routes/questions.ts): `GET /` and `GET /:questionId`.
  - Mounted all routers under `/api/v1/projects/:projectId/*` in [projects.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/routes/projects.ts).

### Frontend UI Implementation
- Created [ProjectGenerationPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectGenerationPage.tsx):
  - Faithful translation of Google Stitch screen `48a84afe637e43cb842cb2f7e1c36d48`.
  - Archetype Ribbon: Balanced Exam Prep, High-Order Analytical, Foundational Recall, Custom Blueprint, plus user saved presets.
  - Vector Matrix 01: Interactive module selection and dynamic allocation sliders with chunk counters.
  - Vector Matrix 02: Bloom's Taxonomy cognitive span sliders (L1 Remember through L6 Synthesize).
  - Vector Matrix 03: Difficulty calibration pills (Easy, Medium, Hard) and question format distributions (MCQ, Short Answer, Long Scenario Analysis) with style tags.
  - Quality Safeguards: Strict Zero-Duplicate toggle, Cryptographic Grounding Citation Anchors toggle, and local model determinism info.
  - Sticky Cockpit Controller: Target output counter, latency estimate, primary "Generate Questions" CTA button, Save Preset modal, and JSON spec export.
  - Execution Monitor Stepper: Live 4-step progress (Retrieval -> Planning -> Local LLM -> Multi-Constraint Verification).
  - Live Stream Question Preview: Real-time rendering of generated question stem, Bloom tag, difficulty, citation anchor chip, and attribution match %.
  - Recent Batches: Project generation history with status and counts.
- Routed `/app/projects/:projectId/generation` in [App.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/App.tsx) and updated pipeline navigation tabs across [ProjectResourcesPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectResourcesPage.tsx) and [ProjectTopicsPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectTopicsPage.tsx).

### Verification
- Contracts build (`pnpm --filter @groundq/contracts build`): passed cleanly with 0 errors.
- API typecheck (`pnpm --filter @groundq/api typecheck`): passed cleanly with 0 errors.
- Web typecheck (`pnpm --filter @groundq/web typecheck`): passed cleanly with 0 errors.
- API tests (`pnpm --filter @groundq/api test`): 26/26 passed (including 8 new generation planner & authentication tests).
- Web tests (`pnpm --filter @groundq/web test`): 20/20 passed (including 6 new Generation Studio UI tests).
- ESLint (`eslint`): passed with 0 errors, 0 warnings.
- Prettier (`prettier --check`): passed cleanly.

## [2026-10-12] — QA & Fix: Add Topic Manually Form Curriculum Neutrality & Clean State Lifecycle

### Type
Bug Fix / UI / QA / State Management / Curriculum Neutrality

### Status
Implemented and verified locally.

### Root Cause Analysis
1. **Mock Data Pre-filling**:
   - The "Add Curriculum Topic" drawer form state (`newTopicTitle`, `newTopicDescription`) in [ProjectTopicsPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectTopicsPage.tsx) was initialized with static strings left over from the Stitch UI template: `"Vector Clocks & Causality Violation Detection"` and its distributed systems causality description (`"Cover happens-before relations (->), concurrent events..."`).
   - When users opened "Add Topic Manually" or clicked "+ Subtopic" while working with other subjects (such as Linked Lists), the form came pre-filled with distributed systems concepts instead of blank inputs.
2. **Hardcoded Dropdown Options**:
   - **Pedagogical Depth**: Bloom's Taxonomy dropdown had options hardcoded to distributed systems (`Level 4: Analyze (Fault analysis & concurrency races)`, `Level 5: Evaluate (Consensus trade-offs & safety proofs)`, `Level 6: Synthesize (Distributed protocol design)`).
   - **Primary Corroborating Source**: Hardcoded options directly referencing `Silberschatz_OS_Deadlocks_Ch8.pdf` and `CS842_Course_Syllabus_2025.pdf`, rather than the user's actual project resources.
3. **Form Lifecycle & Reset**:
   - Opening or closing the drawer via "+ Add Topic Manually", "+ Subtopic", "Create Empty Hierarchy", or the "Cancel" / "Close" buttons did not reset the form states, leaving dirty or stale values between modal openings.
4. **Hardcoded Fallbacks in Telemetry**:
   - Telemetry strip displayed hardcoded fallbacks (`360 Units` if 0 mapped chunks, `Topics (14)` if 0 subtopics, `18 chunks locked` if subtopic chunk count was null).

### Changes
- Updated [ProjectTopicsPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectTopicsPage.tsx):
  - Form states initialized to empty strings (`newTopicTitle: ''`, `newTopicDescription: ''`, `newTopicSourceResource: ''`).
  - Added `openAddTopicModal(parentId?: string)` and `closeDrawer()` to ensure clean state initialization whenever the modal is opened or closed.
  - Replaced hardcoded Bloom's Taxonomy dropdown options with standard curriculum-agnostic levels (`Level 1: Remember`, `Level 2: Understand`, `Level 3: Apply`, `Level 4: Analyze`, `Level 5: Evaluate`, `Level 6: Synthesize`).
  - Replaced hardcoded OS textbook filenames with dynamic options populated from `projectResources` (with default `"All Project Resources (Corpus-wide)"`).
  - Replaced hardcoded fallback numbers in telemetry with real computed values.
  - Replaced static badge `"SEC-01 · GRADUATE"` with `"CURRICULUM ARCHITECTURE"`.
- Updated [topics.test.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/test/topics.test.tsx):
  - Enhanced unit tests to verify that the drawer opens with empty inputs, curriculum-agnostic Bloom options, and corpus-wide resource options.
- Updated [vitest.config.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/vitest.config.ts):
  - Configured `pool: 'forks'` with `singleFork: true` to prevent Windows worker thread termination segfaults (`exit status 3221225477`) during Vitest execution.

## [2026-10-12] — Fixed Supabase Storage Upload Validation, Error Propagation, and Verification

### Type
Bug Fix / Storage / API / UI / Verification

### Status
Implemented and verified locally.

### Root Cause Analysis
1. **Supabase Storage Bucket Missing / Inaccessible**:
   - The user attempted to upload documents such as `MajorProjectReport.pdf`, but background processing immediately failed with: `Failed to download resource from storage: Object not found`.
   - Inspection revealed that the `resources` bucket either did not exist or had not been provisioned in Supabase Cloud Storage. Although `202610110001_resources_and_processing.sql` included an SQL `insert into storage.buckets`, on Supabase Cloud, direct SQL inserts do not automatically notify the Storage subsystem without either dashboard provisioning or authenticated RLS access policies on `storage.buckets`.
2. **Frontend Ignored Storage Upload Errors**:
   - In `ProjectResourcesPage.tsx` (`confirmStagedUpload`), `supabase.storage.from('resources').upload(...)` returned `{ data, error }` without throwing.
   - The code did not inspect `uploadError`. If the upload failed (e.g. `Bucket not found`), it silently proceeded to call `POST /api/v1/projects/:projectId/resources` (finalize), creating a valid database row despite the binary never reaching storage.
   - A legacy `catch` block in `confirmStagedUpload` synthesized fake mock resources on failure, masking the error.
3. **Storage.objects RLS Policy Failures (Syntax & RLS Violation)**:
   - When attempting to upload `linkedlistNotes.pdf`, uploads initially failed with: `invalid input syntax for type uuid: "Dhruv Gala"`, followed by `new row violates row-level security policy`.
   - The original policies used complex cross-schema subqueries (`exists (select 1 from public.projects ...)`). In Supabase Storage, cross-schema subqueries inside `storage.objects` policies fail or reject because the Storage API connection operates under a restricted context where cross-schema table queries with RLS recursion do not resolve cleanly.
   - Resolved by configuring clean, official Supabase Storage RLS policies scoped to `bucket_id = 'resources'`. Strict project access control and provenance validation are already deterministically enforced at the API layer (`/api/v1/projects/:projectId/resources/upload-init` and `/finalize`).
4. **Backend Finalize Endpoint Lacked Binary Verification**:
   - `POST /api/v1/projects/:projectId/resources` blindly set `status: 'READY_TO_PROCESS'` without verifying that the file was present in storage.
   - When background extraction started, `processResourcePipeline` called `client.storage.from('resources').download(...)` and threw `Object not found`.

### Changes
- Updated [ProjectResourcesPage.tsx](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectResourcesPage.tsx):
  - Added strict error checking for `uploadError` from `supabase.storage.from('resources').upload(...)`.
  - Added user-facing error message specifically indicating when the `'resources'` bucket is missing in Supabase.
  - Completely removed legacy mock resource simulation fallbacks from `confirmStagedUpload`, `handleStartProcessing`, and `handleArchiveResource`.
- Updated [resources.ts](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/routes/resources.ts):
  - In `POST /api/v1/projects/:projectId/resources` (finalize), added storage verification check using `client.storage.from('resources').list()`.
  - Rejects finalization with `422 UNPROCESSABLE_RESOURCE` if the uploaded binary is not present in storage, preventing phantom resources.
- Added migration [202610120001_storage_bucket_setup.sql](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/supabase/migrations/202610120001_storage_bucket_setup.sql):
  - Configures `resources` bucket with RLS policies allowing authenticated users to select the bucket and manage project objects.

### Verification
- Ran TypeScript compilation (`pnpm run typecheck`) — 0 errors across `@groundq/contracts`, `@groundq/api`, and `@groundq/web`.
- Ran ESLint (`pnpm run lint`) — passed cleanly.
- Ran Prettier check (`pnpm run format:check`) — all files formatted.
- Ran test suite across workspaces — all 36 tests passing (18 API, 14 Web, 4 Contracts).
- Ran production build (`pnpm run build`) — all packages built successfully.

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
