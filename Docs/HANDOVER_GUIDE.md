# GroundQ — Engineering Handover Guide

**Target Audience:** Future Engineers, AI Coding Agents, System Architects, and Technical Reviewers  
**Last Updated:** October 2026  
**System Version:** V1.1 (Dual-Engine Architecture)  
**Primary Documentation Hub:** [`Docs/index.md`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/Docs/index.md)  

---

## 1. Executive Summary & Mission

**GroundQ** is a localhost modular-monolith educational question generation platform. It transforms syllabus materials, textbooks, lecture slides, and notes (PDF, DOCX, PPTX) into pedagogically sound, cognitively demanding questions grounded in the supplied resources.

### What GroundQ IS:
- A **controllable question generator** where users specify exact distributions across Bloom's Taxonomy (L1 Remember through L6 Create), difficulty (Easy, Medium, Hard), format (MCQ, Short Answer, Long Scenario), and question style (Analytical, Conceptual, Scenario-based).
- A **Dual-Engine AI system** providing lightning-fast cloud synthesis via Google Gemini API alongside 100% offline localhost execution via Ollama (Qwen 2.5).
- A **provable quality-control pipeline** that validates grounding byte-spans, distractor plausibility, and duplicate thresholds before accepting questions into the question bank.

### What GroundQ is NOT (V1 Out-of-Scope):
- NOT a grading or automated assessment system.
- NOT an adaptive learning platform or student performance tracker.
- NOT a conversational chatbot or tutoring assistant.
- NOT a web-search or internet-scraping question generator.

---

## 2. Technology Stack & Workspace Architecture

GroundQ is structured as a **pnpm monorepo workspace**:

```text
QuestionGeneration/
├── apps/
│   ├── api/             # Node.js + Express backend (TypeScript, ESM)
│   └── web/             # Vite + React 18 + Tailwind CSS frontend (TypeScript)
├── packages/
│   └── contracts/       # Shared Zod schemas, TypeScript types, and DTO contracts
├── Docs/                # Master documentation and architectural specifications
│   ├── index.md         # Master index & golden invariants
│   ├── PRD.md           # Product requirements specification
│   ├── SYSTEM_DESIGN.md # System architecture & component design
│   ├── DATABASE_DESIGN.md # Postgres schema, pgvector, and data contracts
│   ├── API_SPEC.md      # REST/JSON endpoint specification
│   ├── LOG.md           # Verifiable chronological engineering audit trail
│   ├── decisions/       # Architectural Decision Records (ADRs)
│   └── HANDOVER_GUIDE.md# This document
└── supabase/            # Supabase migrations, seed data, and schema definitions
```

### Core Technologies
| Layer | Technology | Role |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons | Localhost UI cockpit |
| **Backend** | Node.js 20+, Express, TypeScript (ESM) | Modular monolith API |
| **Shared Contracts** | Zod, TypeScript | Strict shared DTOs & domain schemas |
| **Relational Database** | Supabase PostgreSQL | Multi-tenant persistence, project scoping |
| **Vector Database** | Supabase `pgvector` (HNSW) | 768-dimensional semantic chunk retrieval |
| **File Storage** | Supabase Storage | Encrypted PDF/DOCX/PPTX asset storage |
| **Cloud AI Engine** | Google Gemini API (`gemini-2.0-flash`) | Primary Turbo generation & topic inference |
| **Local AI Engine** | Ollama (`qwen2.5:7b` / `qwen2.5:3b`) | Offline localhost fallback & demonstrations |
| **Embeddings** | Ollama `nomic-embed-text` | 100% local 768-d chunk embedding |

---

## 3. Environment Setup & Configuration

### Prerequisites
1. **Node.js**: v20.x or later.
2. **pnpm**: v9.x or later (`npm i -g pnpm`).
3. **Ollama**: Installed and running locally (`http://localhost:11434`).
   - Run `ollama pull qwen2.5:7b` (recommended 7B model)
   - Run `ollama pull nomic-embed-text` (embedding model)
4. **Supabase Project**: Free tier Supabase project with PostgreSQL, Auth, and Storage enabled.

### Backend Environment Configuration (`apps/api/.env`)
Create `apps/api/.env` with the following variables:
```bash
PORT=3001
NODE_ENV=development

# Supabase Credentials (Private backend keys)
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# AI Engine Configuration
GEMINI_API_KEY=<your-google-gemini-api-key>
GEMINI_MODEL=gemini-2.0-flash

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

> [!IMPORTANT]
> Never commit `apps/api/.env` or any real API keys to git. `.env` is ignored by `.gitignore`.

### Frontend Environment Configuration (`apps/web/.env`)
Create `apps/web/.env`:
```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_API_URL=http://localhost:3001/api/v1
```

---

## 4. Dual-Engine AI Architecture

The system utilizes an internal provider interface [`AIProvider`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/ai/ai-provider.ts) located in `apps/api/src/ai/`.

### Provider Implementations:
1. **`GeminiProvider`**:
   - Location: `apps/api/src/ai/providers/gemini-provider.ts`
   - Connects to Google Generative Language API via HTTPS POST.
   - Enforces `generationConfig.responseMimeType = "application/json"`.
   - Latency: 1–3 seconds per question.
2. **`OllamaProvider`**:
   - Location: `apps/api/src/ai/providers/ollama-provider.ts`
   - Connects to local Ollama HTTP endpoint (`/api/generate`, `/api/embeddings`).
   - Latency: 60–90 seconds per question on CPU (Ryzen 5 7520U).

### Factory Selector:
```typescript
import { getAIProvider } from '../ai/ai-provider.js';

// Dynamically routes based on user preference
const provider = getAIProvider(model_provider ?? 'gemini', model_name);
const structuredOutput = await provider.generateStructured(prompt, schema);
```

---

## 5. Golden Rules & Invariants

Any engineer or AI agent extending GroundQ must adhere strictly to these rules:

### Invariant 1: Zero Synthetic Slot-Filling Fallbacks
`generateFallbackQuestion` has been abolished. Never generate fake questions by slotting document lines into hardcoded templates. If an LLM call fails, run structural JSON self-healing; if unrecoverable, set `status: 'FAILED'` with granular diagnostics. Slow output is acceptable; fake slop is forbidden.

### Invariant 2: Project-Scoped Multitenancy
Every project belongs to exactly one user (`owner_id = auth.uid()`). All database queries, vector similarity searches, topic hierarchies, and duplicate checks MUST be scoped to `project_id`. Cross-project data leakage is an immediate critical defect.

### Invariant 3: Grounding is Not Answer Extraction
High-order Bloom questions (Analyze, Evaluate, Create) do not require the answer to appear word-for-word in the source text. Grounding means the concepts, mechanisms, and premises derive from the source; the question may present novel analytical scenarios.

### Invariant 4: Monotonic Question Bank & Version Immutability
Questions in a project have sequential numbers (`#01..#N`). When an instructor edits a question, create a new record in `question_versions` (`v1`, `v2`, etc.). Never mutate approved historical question snapshots directly.

### Invariant 5: Anti-Brand Topic Extraction
Topic extraction must exclude desktop software brands (Microsoft Word, Mozilla Firefox, LibreOffice, Adobe) and document metadata (author names, dates). Extract only pedagogical curriculum topics.

---

## 6. Daily Development Workflows

### Running the Monorepo
From the workspace root:
```bash
# Install dependencies across all packages
pnpm install

# Run backend and frontend concurrently
pnpm dev

# Run TypeScript typechecks across workspace
pnpm typecheck

# Run automated tests
pnpm --filter @groundq/contracts test
pnpm --filter @groundq/api test
pnpm --filter @groundq/web test
```

### Adding a New Question Style or Bloom Level
1. Update `packages/contracts/src/generation/index.ts` with new enum values or distributions.
2. Update backend validation rules in `apps/api/src/services/question-validator.ts`.
3. Update frontend preset templates in `apps/web/src/app/pages/ProjectGenerationPage.tsx`.
4. Update `Docs/PRD.md` and `Docs/API_SPEC.md`.
5. Document changes in `Docs/LOG.md`.

---

## 7. Key Files Directory Reference

| Area | Authoritative Source File |
|---|---|
| AI Provider Registry | [`apps/api/src/ai/ai-provider.ts`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/ai/ai-provider.ts) |
| Gemini Driver | [`apps/api/src/ai/providers/gemini-provider.ts`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/ai/providers/gemini-provider.ts) |
| Ollama Driver | [`apps/api/src/ai/providers/ollama-provider.ts`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/ai/providers/ollama-provider.ts) |
| Topic Inferencer | [`apps/api/src/services/topic-inferencer.ts`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/services/topic-inferencer.ts) |
| Question Generator | [`apps/api/src/services/question-generator.ts`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/services/question-generator.ts) |
| Question Validator | [`apps/api/src/services/question-validator.ts`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/api/src/services/question-validator.ts) |
| Generation Studio Page | [`apps/web/src/app/pages/ProjectGenerationPage.tsx`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectGenerationPage.tsx) |
| Resources Page | [`apps/web/src/app/pages/ProjectResourcesPage.tsx`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectResourcesPage.tsx) |
| Question Bank Page | [`apps/web/src/app/pages/ProjectQuestionsPage.tsx`](file:///c:/Users/Dhruv%20Gala/Desktop/QuestionGeneration/apps/web/src/app/pages/ProjectQuestionsPage.tsx) |
