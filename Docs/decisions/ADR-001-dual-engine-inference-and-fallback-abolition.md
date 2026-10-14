# ADR-001: Dual-Engine AI Inference Architecture and Abolition of Synthetic Fallbacks

**Status:** Accepted  
**Date:** 2026-10-14  
**Deciders:** Dhruv Gala, AI Pair-Programming Agent (Antigravity)  
**Consulted:** PRD v1.1, System Design v1.1, Database Design v1.1, API Spec v1.1  

---

## Context

During early testing on a laptop with an AMD Ryzen 5 7520U CPU with Radeon 610M integrated graphics (512MB dedicated VRAM, CPU-only inference), two major architectural failure modes were identified:

1. **Hardware-Bound Inference Latency**: Local Ollama CPU execution took 60–90 seconds per question. On multi-question batches (10–20 questions), generation runs stretched into 15–30 minutes, leading to timeouts or thermal throttling.
2. **Nonsensical Fallback Slop**: When local inference timed out or failed JSON parsing, the backend triggered an emergency fallback routine (`generateFallbackQuestion` in `apps/api/src/services/question-generator.ts`). This routine blindly slotted raw document lines or table-of-contents headings into rigid template stems, generating nonsensical questions (e.g., *"Which of the following describes the fundamental principles of Programming Language?"* with the correct answer being the chapter title *"JavaScript for Beginners 5 1 What is a Programming Language?."*).
3. **Noisy Topic Extraction**: Topic inference captured desktop application names and software headings (such as `1.1 Microsoft Word`, `1.2 Mozilla Firefox`, `1.3 Lotus Notes`) rather than pedagogical curriculum concepts.

The user explicitly mandated:
- "Slow output is okay, bad output is not okay."
- Integrate Google Gemini API for fast, frontier academic synthesis.
- Maintain a capable local model (Qwen 2.5 7B) for offline classroom and professor demonstrations.
- Allow selecting the engine before inferring topics and before generating questions to enable side-by-side project comparisons.
- Completely abolish all synthetic mock slot-filler fallback techniques.

---

## Decision

We adopt a **Dual-Engine Hybrid AI Architecture** with strict quality invariants:

### 1. Dual-Engine Provider Abstraction (`AIProvider`)
The application defines a unified `AIProvider` interface implemented by two distinct drivers:
- **`GeminiProvider` (Cloud Turbo - Default)**:
  - Uses the official Google Generative Language REST API (`gemini-2.0-flash` / `gemini-1.5-flash`).
  - Generates questions in 1–3 seconds with university-level conceptual reasoning.
  - Enforces native JSON schema mode (`responseMimeType: "application/json"`).
  - Requires `process.env.GEMINI_API_KEY` (kept strictly server-side, never committed or exposed to the client).
- **`OllamaProvider` (Localhost Offline - Demonstration)**:
  - Connects to local Ollama (`http://localhost:11434`) running `qwen2.5:7b` (or `qwen2.5:3b`).
  - Provides 100% offline, privacy-first execution for classroom hardware demonstrations.
  - Retains local `nomic-embed-text` embeddings (768 dimensions) for resource chunking and pgvector search.

### 2. Elimination of Synthetic Slot-Filling Fallbacks
`generateFallbackQuestion` is completely abolished and deleted from the codebase.
- Under no circumstances will the system generate fake questions by slotting raw document lines into static templates.
- If an LLM call fails or returns malformed JSON, the pipeline runs an automated structural JSON repair pass.
- If repair is unrecoverable, the item is recorded as `status: 'FAILED'` with granular error telemetry.
- Honest failure diagnostics are required; synthetic slop is forbidden.

### 3. Dual Engine Selectors in UI
Users can select the engine at two critical project stages:
1. **Topic Inference Stage**: On the Project Resources tab, before triggering topic extraction, the user can choose *Google Gemini 2.0 Flash (Cloud Turbo)* or *Qwen 2.5 (Localhost Offline)*.
2. **Question Generation Stage**: In the Generation Studio cockpit, the model selector offers both Cloud Turbo (`gemini-2.0-flash`) and Local Offline (`qwen2.5:7b`), persisting the selection into `generation_runs.model_provider` and `generation_runs.model_name`.

### 4. Topic Extraction Anti-Noise Constraints
The topic extraction prompt explicitly mandates extracting genuine conceptual units and incorporates negative constraints against software brands (Microsoft Word, Mozilla Firefox, Adobe Acrobat, etc.), editor titles, and document metadata.

---

## Consequences

### Positive
- **Instant Latency Relief**: Question generation latency with Gemini drops from ~90s to ~2s per question.
- **Academic Standard Output**: Questions exhibit true Bloom cognitive depth (Apply, Analyze, Evaluate) with plausible distractors and evidence-grounded rationales.
- **Side-by-Side Comparison**: Educators can build two projects from the same PDF to demonstrate the capabilities and tradeoffs between cloud frontier LLMs and offline on-device SLMs.
- **Integrity**: Zero synthetic placeholder text ever reaches the question bank.

### Negative / Trade-offs
- Cloud inference requires internet connectivity and an active `GEMINI_API_KEY`.
- Local CPU inference with Qwen 2.5 7B remains resource-heavy (~60s per call), but users are informed of this reality transparently.
