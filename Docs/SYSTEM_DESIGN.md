# Syllabus-Grounded Controllable Question Generation

## System Design & Architecture Specification — V1

**Document status:** Frozen for V1 implementation  
**Audience:** Developers, AI coding agents, reviewers, and project team  
**Primary purpose:** Authoritative technical specification for implementing V1  
**Deployment target:** Local application execution only  
**AI inference target:** Local Ollama runtime  
**Managed backend services:** Supabase Cloud  
**Repository style:** Monorepo  

---

## 1. Document Purpose

This document is the technical source of truth for the V1 architecture of the project.

Coding agents must use this document together with the PRD and database/API specifications when implementing or modifying the system.

### Source-of-truth priority

When requirements appear to conflict, use this order:

1. Explicitly approved user/project decisions
2. This System Design document
3. PRD
4. Database/API specifications derived from this document
5. Implementation convenience

Implementation convenience must **never override a product or architectural constraint**.

---

# 2. Product Boundary

The system is a **role-neutral, authenticated question-generation platform**.

The core workflow is:

> User provides study resources → system processes and indexes them → user configures a multidimensional question blueprint → local LLM generates questions grounded in the provided resources → validation checks the questions → invalid questions are regenerated or sent for manual review → accepted questions are stored in the project's question bank.

The product is intentionally **not**:

- a grading system
- an answer-evaluation system
- an adaptive learning platform
- a student performance analytics platform
- a tutoring chatbot
- a web-search-based question generator
- a model-comparison/research dashboard in V1
- a numerical solver in V1

---

# 3. V1 Deployment Philosophy

## 3.1 Local application execution

V1 does **not** deploy the React frontend or Node backend as public production services.

They run locally:

```text
Browser
  ↓
localhost React application
  ↓
localhost Node/Express API
```

## 3.2 Local AI inference

LLM inference is performed locally using **Ollama**.

No paid or cloud LLM API is required for V1.

The application must not depend on a cloud LLM for its core functionality.

## 3.3 Cloud-managed application services

Although the application and LLM run locally, V1 may use Supabase Cloud for:

- Authentication
- Google OAuth
- PostgreSQL
- pgvector
- Object/file storage

This is intentional. V1 is **local-execution**, not fully offline.

Therefore internet connectivity is required for Supabase services and Google OAuth.

## 3.4 V2 is separate

V2 may introduce:

- public deployment
- hosted frontend/backend
- cloud LLM APIs
- remote inference servers
- concurrent multi-user workloads
- production infrastructure

V1 must not be expanded solely to prepare for those V2 requirements.

The architecture may use clean abstractions that make future replacement possible, but V1 implementation must remain simple.

---

# 4. High-Level Architecture

```text
                         ┌─────────────────────────────┐
                         │           USER              │
                         │         Browser             │
                         └──────────────┬──────────────┘
                                        │
                                        │ HTTP
                                        ▼
                         ┌─────────────────────────────┐
                         │      React + TypeScript     │
                         │      Vite + Tailwind        │
                         │      shadcn/ui              │
                         └──────────────┬──────────────┘
                                        │
                              REST / JSON API
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │    Node.js + TypeScript     │
                         │         Express API        │
                         │                             │
                         │ Auth / Projects / Resources│
                         │ Topics / Blueprints        │
                         │ Generation / Retrieval     │
                         │ Validation / Questions     │
                         └───────┬───────────┬─────────┘
                                 │           │
                  ┌──────────────┘           └────────────────┐
                  │                                           │
                  ▼                                           ▼
      ┌────────────────────────────┐              ┌────────────────────────┐
      │       Supabase Cloud       │              │    Local Ollama        │
      │                            │              │                        │
      │ PostgreSQL                 │              │ Lightweight LLM         │
      │ pgvector                   │              │ Local embeddings*       │
      │ Supabase Auth              │              │ Local inference API     │
      │ Google OAuth integration   │              │                        │
      │ Supabase Storage           │              └────────────────────────┘
      └────────────────────────────┘

* Exact embedding runtime/model is a replaceable implementation detail.
```

Supabase provides hosted PostgreSQL, Auth and Storage, while pgvector provides vector storage/search inside Postgres. See: https://supabase.com/docs/guides/database/extensions/pgvector and https://supabase.com/docs/guides/storage

Ollama exposes a local API for model inference and embeddings, making it suitable as the V1 local AI runtime. See: https://docs.ollama.com/api

---

# 5. Architectural Style

## 5.1 Modular monolith

V1 uses a **modular monolith**, not microservices.

The backend is one deployable Node.js process with strong internal module boundaries.

```text
Node API
│
├── auth
├── users
├── projects
├── resources
├── documents
├── topics
├── blueprints
├── generation
├── retrieval
├── validation
├── deduplication
├── diversity
└── questions
```

### Why

V1 has one local application, one local AI runtime, and no concurrent distributed workload requirement.

Microservices, Redis, Kafka, RabbitMQ, Kubernetes, or separate AI services are explicitly unnecessary for V1.

---

# 6. Technology Stack

| Layer | V1 Technology | Responsibility |
|---|---|---|
| Frontend | React + TypeScript | User interface |
| Build tool | Vite | Frontend development/build |
| UI | Tailwind CSS + shadcn/ui | UI system |
| Backend | Node.js + TypeScript + Express | API and application orchestration |
| Database | PostgreSQL via Supabase | Persistent relational data |
| Vector search | pgvector | Embeddings and semantic retrieval |
| Authentication | Supabase Auth | Identity/session management |
| Social login | Google OAuth via Supabase Auth | Google sign-in |
| File storage | Supabase Storage | Original user-uploaded resources |
| LLM runtime | Ollama | Local inference |
| LLM | One selected lightweight local model | Question generation/semantic validation where applicable |
| Embeddings | Local embedding provider | Document/query embeddings |
| API style | REST/JSON | Frontend-backend communication |
| Repository | Monorepo | Shared code and coordinated development |
| Version control | Git | Source control |

The exact LLM and embedding model are configurable implementation decisions and must not leak model-specific assumptions into unrelated business logic.

---

# 7. Monorepo Structure

Recommended V1 repository layout:

```text
question-generator/
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── projects/
│       │   │   ├── resources/
│       │   │   ├── documents/
│       │   │   ├── topics/
│       │   │   ├── blueprints/
│       │   │   ├── generation/
│       │   │   ├── retrieval/
│       │   │   ├── validation/
│       │   │   ├── deduplication/
│       │   │   ├── diversity/
│       │   │   └── questions/
│       │   ├── ai/
│       │   │   ├── providers/
│       │   │   ├── prompts/
│       │   │   ├── schemas/
│       │   │   └── parsers/
│       │   ├── middleware/
│       │   ├── config/
│       │   └── server.ts
│       └── package.json
│
├── packages/
│   ├── shared-types/
│   ├── validation-schemas/
│   └── config/
│
├── supabase/
│   └── migrations/
│
├── docs/
│   ├── README.md
│   ├── PRD.md
│   ├── SYSTEM_DESIGN.md
│   ├── DATABASE_DESIGN.md
│   └── API_SPEC.md
│
├── .env.example
├── package.json
└── README.md
```

The exact workspace manager may be npm/pnpm; the monorepo boundaries are the important architectural requirement.

---

# 8. Frontend Architecture

The React application is responsible for presentation and user interaction.

## Frontend responsibilities

- Authentication UI
- Project management UI
- Resource upload UI
- Topic-map editor
- Question blueprint builder
- Generation progress
- Validation result display
- Question bank browsing/filtering
- Question review/manual review
- Question metadata display

## Frontend restrictions

The frontend must **not**:

- call Ollama directly
- write directly to arbitrary database tables
- implement core validation logic as the authoritative source
- implement RAG retrieval independently of the backend
- contain service credentials

All business-critical operations go through the backend API.

Supabase's frontend SDK may be used for authentication/session handling where appropriate, but authorization-sensitive operations must still be enforced server-side.

---

# 9. Backend Architecture

The backend uses a layered modular structure.

```text
HTTP Route
    ↓
Controller
    ↓
Application Service
    ↓
Domain/Business Logic
    ↓
Repository / External Adapter
    ↓
Database / Storage / Ollama
```

## Controllers

Translate HTTP requests/responses into application-level commands.

Controllers should remain thin.

## Services

Contain business behavior such as:

- project authorization
- resource ingestion
- blueprint validation
- generation orchestration
- question validation
- duplicate detection

## Repositories

Encapsulate persistence operations.

Business logic must not contain large amounts of raw SQL or Supabase client code.

## Adapters

External/local infrastructure is accessed behind interfaces such as:

```text
AIProvider
EmbeddingProvider
StorageProvider
```

This keeps infrastructure replaceable.

---

# 10. Authentication Architecture

Authentication is handled by **Supabase Auth**.

Primary V1 login:

> Continue with Google

Supabase Auth supports Google sign-in for web applications. Google OAuth requires a Google Cloud OAuth client and configured authorized origins/redirect URIs. See: https://supabase.com/docs/guides/auth/social-login/auth-google

## Authentication flow

```text
User
  ↓
React Login Page
  ↓
supabase.auth.signInWithOAuth({ provider: 'google' })
  ↓
Supabase Auth
  ↓
Google OAuth
  ↓
Google consent/login
  ↓
Supabase callback
  ↓
Authenticated Supabase session
  ↓
React
```

## Backend authentication

The frontend sends the authenticated access token with protected API requests.

```text
Authorization: Bearer <access-token>
```

Backend middleware validates the session/token and derives the authenticated user identity.

The backend must never trust a user-supplied `user_id` as proof of ownership.

---

# 11. Authorization Model

V1 is role-neutral.

There is no teacher/student authorization distinction.

Authorization is ownership-based:

```text
User
  ↓ owns
Project
  ↓ owns
Resources / Topics / Blueprints / Generation Runs / Questions
```

Every project-scoped API operation must verify:

```text
authenticated_user_id == project.owner_id
```

or an equivalent database-enforced ownership policy.

Users must never be able to read, modify, delete or search another user's project data.

---

# 12. Supabase Architecture

Supabase Cloud is used for:

```text
Supabase Cloud
│
├── Auth
│   └── Google OAuth
│
├── PostgreSQL
│   └── Application data
│
├── pgvector
│   └── Chunk embeddings
│
└── Storage
    └── Original PDF/DOCX/PPTX files
```

Supabase Storage is intended for files outside the relational database and supports access policies for controlling object access. See: https://supabase.com/docs/guides/storage

Supabase Postgres supports pgvector for storing and querying embeddings for RAG. See: https://supabase.com/docs/guides/database/extensions/pgvector

---

# 13. File Storage Architecture

Supported V1 resource formats:

- PDF
- DOCX
- PPTX/PPT

No other input formats are required in V1.

Original files are stored in Supabase Storage.

The relational database stores metadata, not the entire binary file.

Conceptual object path:

```text
resources/{user_id}/{project_id}/{resource_id}/{safe_filename}
```

The exact path must be generated server-side and must never be trusted directly from a client.

Supabase recommends dedicated file storage outside Postgres for file assets and supports fine-grained storage policies. See: https://supabase.com/docs/guides/storage

For uploads above roughly 6 MB, use a resumable upload strategy rather than assuming standard upload is always ideal. Supabase currently recommends TUS resumable uploads for larger files. See: https://supabase.com/docs/guides/storage/uploads/standard-uploads

---

# 14. Resource Ingestion Pipeline

A resource goes through the following lifecycle:

```text
User selects file
      ↓
Backend validates file type/size
      ↓
Create Resource record
      ↓
Upload original file to Supabase Storage
      ↓
Create Processing Job/State
      ↓
Extract text
      ↓
Identify pages/slides/sections where possible
      ↓
Normalize text
      ↓
Chunk content
      ↓
Attach provenance metadata
      ↓
Generate embeddings locally
      ↓
Store chunks + embeddings in PostgreSQL/pgvector
      ↓
Resource becomes READY
```

Processing states should include at minimum:

```text
UPLOADING
PROCESSING
READY
FAILED
```

The user must be able to see when a resource is not yet ready for question generation.

---

# 15. Document and Chunk Provenance

Every chunk must retain enough metadata to trace it back to the original resource.

Minimum conceptual fields:

```text
chunk_id
resource_id
project_id
text
page_number / slide_number (nullable)
section_title (nullable)
chunk_index
embedding
created_at
```

The exact schema is defined in the database design document.

Provenance is required for:

- grounded generation
- evidence display
- debugging retrieval
- research evaluation
- source traceability

---

# 16. Topic Map Architecture

The system extracts a topic hierarchy from uploaded study material.

Example:

```text
Operating Systems
├── Process Management
│   ├── Process States
│   ├── Scheduling
│   └── IPC
├── Deadlocks
│   ├── Conditions
│   ├── Prevention
│   └── Avoidance
└── Memory Management
    ├── Paging
    ├── Segmentation
    └── Virtual Memory
```

Important distinction:

> An inferred topic map is not automatically the official syllabus.

If the user provides only study material, the system may create an inferred topic map.

If an explicit syllabus is supplied later, it may be represented separately from the inferred topic map.

## User control

The user can:

- rename topics
- add topics
- delete topics
- merge topics
- split topics
- reorder topics
- change hierarchy

After editing, the user-approved topic map becomes the authoritative project-level taxonomy used for generation controls.

---

# 17. Project Architecture

Every generation belongs to exactly one project.

Conceptually:

```text
User
 ├── Project A
 │   ├── Resources
 │   ├── Topic Map
 │   ├── Blueprints
 │   ├── Generation Runs
 │   └── Question Bank
 │
 └── Project B
     ├── Resources
     ├── Topic Map
     ├── Blueprints
     ├── Generation Runs
     └── Question Bank
```

Projects provide the isolation boundary for:

- resources
- embeddings
- topics
- question history
- duplicate detection
- generation history

---

# 18. Question Blueprint Architecture

The blueprint defines exactly what kind of questions the user wants.

A blueprint must support independent dimensions.

## 18.1 Quantity

The user chooses the number of questions to generate.

Example:

```text
10 questions
```

## 18.2 Question format/type

V1:

- MCQ
- Short Answer
- Long Answer

Numerical questions are deferred beyond V1.

## 18.3 Bloom cognitive level

V1 supports all six:

1. Remember
2. Understand
3. Apply
4. Analyze
5. Evaluate
6. Create

## 18.4 Difficulty

V1 supports:

- Easy
- Medium
- Hard

Difficulty is independent of Bloom level.

## 18.5 Question style/category

V1 should support a multidimensional category system including:

- Conceptual
- Comparative
- Application-based
- Scenario-based
- Case-based
- Analytical
- Cause-and-effect
- Evaluative
- Design/Synthesis

The exact normalized enum can be refined during API/database design, but the product must preserve the concept of independent dimensions.

## 18.6 Topic selection

User can choose:

- all topics
- one topic
- multiple topics
- weighted topic distribution

## 18.7 Distribution weights

Users can explicitly control distributions.

Example:

```text
Bloom
Apply      40%
Analyze    40%
Evaluate   20%

Difficulty
Medium     30%
Hard       70%

Style
Scenario   50%
Analytical 30%
Comparative 20%
```

The generation planner converts these requested distributions into per-question targets before generation.

## 18.8 Presets

V1 should support reusable blueprint presets conceptually, for example:

- Custom
- Exam Preparation
- Deep Understanding
- Revision
- High-Order Thinking

Presets are simply predefined blueprint configurations, not separate AI systems.

---

# 19. Question Planning Layer

The system must not pass only a vague prompt such as:

> Generate 20 hard questions.

Instead:

```text
Blueprint
   ↓
Question Planner
   ↓
Explicit per-question targets
   ↓
Retriever + Generator
```

Example:

```text
Q1  Apply + Scenario + Medium
Q2  Apply + Scenario + Medium
Q3  Analyze + Analytical + Hard
Q4  Analyze + Analytical + Hard
Q5  Evaluate + Comparative + Hard
...
```

This planner is responsible for transforming aggregate user constraints into a concrete generation plan.

---

# 20. RAG Architecture

RAG is project-scoped.

```text
Generation Target
       ↓
Topic Constraints
       ↓
Question Intent
       ↓
Retrieval Query Construction
       ↓
Embedding
       ↓
pgvector Similarity Search
       ↓
Metadata Filtering
       ↓
Relevant Chunks
       ↓
Context Assembly
       ↓
Prompt Construction
       ↓
Ollama
```

Supabase pgvector is the vector-search layer. See: https://supabase.com/docs/guides/database/extensions/pgvector

V1 should begin with semantic retrieval plus project/topic metadata filtering.

Hybrid retrieval and reranking are future optimization options, not V1 requirements.

---

# 21. Grounding Definition

Grounding has a deliberate V1 definition:

> **The question must be meaningfully grounded in the concepts, information, relationships, principles, or examples present in the user-provided resources. The answer does not have to appear verbatim in those resources.**

This distinction is essential.

## Valid example

Source material explains synchronization primitives.

Generated question presents a new synchronization scenario and asks the user to select or explain the appropriate strategy.

The scenario is novel, but the concepts required to construct the question come from the source.

## Invalid example

The uploaded material discusses operating systems, but the generated question requires unrelated facts about modern CPU architecture that do not derive from the supplied resources.

The system must reject such questions as insufficiently grounded.

## Therefore

Grounding is **not** equivalent to:

> “The answer must be extractable word-for-word from the document.”

The system is intended specifically to generate higher-order questions rather than simple WH/definition/recall questions.

---

# 22. Question Generation Pipeline

For each planned question:

```text
1. Receive Question Target
2. Retrieve relevant resource chunks
3. Construct grounded context
4. Construct structured generation prompt
5. Call local Ollama model
6. Parse structured output
7. Perform deterministic validation
8. Perform semantic validation
9. Perform duplicate detection
10. Perform batch-level diversity checks where applicable
11. Accept or regenerate
```

The LLM output must conform to a machine-readable schema.

Free-form LLM output must not be used as the authoritative application object.

---

# 23. AI Provider Abstraction

V1 implements exactly one provider:

```text
AIProvider
   └── OllamaProvider
```

The backend should expose an internal interface conceptually equivalent to:

```text
generate(...)
embed(...)
```

The rest of the application must depend on this interface rather than hard-coding Ollama calls in business logic.

V2 may add:

```text
AIProvider
├── OllamaProvider
├── OpenAIProvider
├── GeminiProvider
└── OtherProvider
```

V2 providers are **not implemented in V1**.

---

# 24. Embedding Architecture

Embeddings must be generated locally in V1.

Conceptual abstraction:

```text
EmbeddingProvider
   └── LocalEmbeddingProvider
```

The embedding model must remain consistent between:

- document chunk embeddings
- retrieval query embeddings

Changing the embedding model requires re-embedding affected data.

Embeddings are stored in Postgres using pgvector. Supabase documents pgvector as the Postgres extension for storing and querying embeddings. See: https://supabase.com/docs/guides/database/extensions/pgvector

---

# 25. Validation Architecture

Validation is a first-class subsystem and must not be embedded blindly inside the generation prompt.

```text
Candidate Question
        ↓
┌───────────────────────────────┐
│ Deterministic Validation      │
├───────────────────────────────┤
│ Schema                        │
│ Required fields               │
│ Question type rules           │
│ MCQ structural rules          │
└───────────────┬───────────────┘
                ↓
┌───────────────────────────────┐
│ Semantic Validation            │
├───────────────────────────────┤
│ Grounding                     │
│ Bloom alignment               │
│ Difficulty alignment          │
│ Style alignment               │
│ Topic alignment               │
│ Question quality               │
└───────────────┬───────────────┘
                ↓
┌───────────────────────────────┐
│ Project-Level Quality          │
├───────────────────────────────┤
│ Duplicate detection           │
│ Batch diversity               │
└───────────────┬───────────────┘
                ↓
             PASS / FAIL
```

---

# 26. Deterministic Validation Rules

The system should deterministically check rules that do not require semantic reasoning.

Examples:

- Required field missing
- Invalid question type
- Empty question text
- Invalid option count
- Duplicate option strings
- Missing correct MCQ option
- Invalid blueprint distribution
- Invalid question count
- Unsupported file type
- Duplicate exact question string

These checks should not consume LLM inference where normal application logic is sufficient.

---

# 27. Semantic Validation Rules

Semantic validation covers:

### Grounding
Is the question meaningfully derived from the supplied resources?

### Topic alignment
Does it belong to the selected topic?

### Bloom alignment
Does actual cognitive demand match requested Bloom level?

### Difficulty alignment
Does actual difficulty match requested difficulty?

### Style alignment
Does the question genuinely match the requested style/category?

### Quality
Is the question coherent, relevant, and non-trivial?

For subjective questions, the system should not require the answer to be a direct extract from the source.

---

# 28. MCQ Validation

For MCQs, validation must include at least:

- exactly one intended correct answer
- answer is consistent with the source/context and question
- distractors are not accidental correct answers
- no duplicate options
- options are structurally valid
- options do not reveal the answer through formatting or obvious lexical patterns where detectable

MCQ validation is a special case of the general validation framework.

---

# 29. Duplicate Detection

Duplicate detection is **project-scoped**, never global across the user's account.

The user must be able to choose before generation whether duplicate checking is enabled.

Two scopes are relevant:

### Current batch

Prevent duplicate or near-duplicate questions within the newly generated set.

### Existing project question bank

Compare candidate questions against existing questions within the same project.

The system should use:

- exact string comparison for obvious duplicates
- semantic embeddings for paraphrased/meaning-level duplicates

A different wording must not automatically be treated as a different question.

---

# 30. Diversity Architecture

After individual questions pass validation, the batch is evaluated as a set.

The system should consider:

- semantic similarity
- topic concentration
- repeated source chunks
- repeated question structures
- overuse of the same pattern
- requested distribution constraints

Diversity checks must respect the user's selected blueprint rather than arbitrarily enforcing diversity that conflicts with explicit user settings.

---

# 31. Regeneration and Retry Policy

Failed questions must never be silently accepted.

```text
Generate
   ↓
Validate
   ├── PASS → Accept
   └── FAIL → Regenerate
                  ↓
               Validate
                  ↓
          retry until max attempts
                  ↓
           NEEDS_REVIEW if still failing
```

The system must define a finite retry limit.

### Critical rule

> **Never silently relax user constraints to reach the requested question count.**

If the user asks for 10 questions and only 7 can satisfy the constraints after the allowed attempts:

```text
7 accepted
3 need manual review
```

The system must not quietly lower Bloom level, difficulty, grounding strictness, duplicate checking, or another user-selected constraint.

---

# 32. Manual Review State

Questions that repeatedly fail validation enter a manual-review state.

Example lifecycle:

```text
GENERATED
   ↓
VALIDATING
   ↓
FAILED
   ↓
REGENERATING
   ↓
FAILED AGAIN
   ↓
NEEDS_REVIEW
```

The UI must explain which validation rules failed.

The system should expose structured evidence such as:

```text
Grounding: PASS
Bloom: FAIL
Difficulty: PASS
Duplicate: FAIL

Duplicate similarity: 0.89
Bloom mismatch: requested Analyze, predicted Understand
```

This is a structured validation explanation, not hidden model chain-of-thought.

---

# 33. Generation Job Lifecycle

Generation should be represented as a persistent job/run rather than one long synchronous HTTP request.

```text
CREATED
  ↓
QUEUED
  ↓
PLANNING
  ↓
RETRIEVING
  ↓
GENERATING
  ↓
VALIDATING
  ↓
REGENERATING (optional)
  ↓
COMPLETED
```

Failure paths:

```text
FAILED
NEEDS_REVIEW
CANCELLED (future/optional)
```

V1 does not require Redis, Kafka, RabbitMQ, or a distributed job queue.

The state is persisted in Postgres and the local backend manages the generation loop.

---

# 34. Question Storage Model

A generated question is a persistent project object.

Conceptually it contains:

```text
Question
├── project
├── generation run
├── topic
├── question type
├── Bloom level
├── difficulty
├── style/category
├── question text
├── source references
├── validation state
├── duplicate status
└── timestamps
```

For MCQs, add:

```text
options
correct_option
```

For subjective V1 questions:

> Store the question only as the primary output.

Do not make answer generation/grading a required V1 workflow.

Optional internal metadata may be stored when necessary for validation, but the product UI should remain focused on questions.

---

# 35. Question Versioning

Manual edits must not destroy the historical generation state.

Recommended conceptual model:

```text
Question
   ↓
Version 1  ← AI generated
   ↓
Version 2  ← user edited
   ↓
Version 3  ← user edited
```

Every version should retain provenance to the generation run or manual edit that created it.

Validation results should be associated with the applicable version, because editing a question can invalidate a previous validation result.

---

# 36. Manual Editing Behavior

Users may edit:

- question text
- options for MCQs
- selected answer for MCQs
- topic
- Bloom level
- difficulty
- style/category

After manual edits, the previous validation state becomes stale.

Recommended behavior:

```text
User edits question
       ↓
Mark validation = OUTDATED
       ↓
Optional/automatic re-validation
```

The system must never present validation from an older version as though it validates the edited content.

---

# 37. Question Bank Architecture

The project-level question bank supports:

- browsing
- search
- filtering
- topic filtering
- Bloom filtering
- difficulty filtering
- style filtering
- question type filtering
- validation-status filtering
- generation-run filtering
- review status

Questions belong to exactly one project.

This question history is used by project-level duplicate detection.

---

# 38. Source Evidence Architecture

Every accepted generated question should retain references to the source material used during retrieval.

Conceptually:

```text
Question
   ↓
Source Reference(s)
   ├── Resource
   ├── Page/Slide
   └── Chunk
```

The UI should allow the user to inspect the source evidence supporting the question.

Source evidence is not necessarily an answer key. It is evidence that the question was grounded in the resource.

---

# 39. API Architecture

The API should be versioned from the beginning.

Recommended base path:

```text
/api/v1
```

High-level API groups:

```text
/api/v1/auth
/api/v1/users
/api/v1/projects
/api/v1/projects/:projectId/resources
/api/v1/projects/:projectId/topics
/api/v1/projects/:projectId/blueprints
/api/v1/projects/:projectId/generation-runs
/api/v1/projects/:projectId/questions
```

Exact routes belong in the API specification document.

---

# 40. Key Request Flows

## 40.1 Create project

```text
React
 ↓
POST /api/v1/projects
 ↓
Auth middleware
 ↓
Project service
 ↓
Postgres
 ↓
Project created
```

## 40.2 Upload resource

```text
React
 ↓
POST /resources
 ↓
Validate ownership/type
 ↓
Supabase Storage
 ↓
Resource DB record
 ↓
Ingestion
```

## 40.3 Generate questions

```text
React
 ↓
POST /generation-runs
 ↓
Persist blueprint
 ↓
Create generation run
 ↓
Question planner
 ↓
RAG
 ↓
Ollama
 ↓
Validation
 ↓
Regeneration if necessary
 ↓
Persist accepted questions
```

## 40.4 Retrieve question bank

```text
React
 ↓
GET /questions
 ↓
Auth + project ownership
 ↓
Postgres
 ↓
Filtered questions
```

---

# 41. Error Handling

The API must expose structured errors.

Examples:

```text
400 VALIDATION_ERROR
401 UNAUTHENTICATED
403 FORBIDDEN
404 NOT_FOUND
409 CONFLICT
413 FILE_TOO_LARGE
422 UNPROCESSABLE_RESOURCE
429 TOO_MANY_REQUESTS (future if applicable)
500 INTERNAL_ERROR
502 AI_PROVIDER_ERROR
504 AI_TIMEOUT
```

The frontend must show useful user-facing messages without exposing internal stack traces or secrets.

---

# 42. Configuration and Environment Variables

No secrets may be committed to Git.

Expected categories include:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # backend only, never frontend
GOOGLE_CLIENT_ID             # depending on Supabase configuration flow
GOOGLE_CLIENT_SECRET         # backend/config only where applicable
OLLAMA_BASE_URL
OLLAMA_MODEL
EMBEDDING_MODEL
DATABASE_URL                 # only if directly used; avoid duplicating Supabase credentials unnecessarily
```

Exact variables depend on the selected Supabase integration approach.

Public frontend keys may be exposed according to Supabase's normal client model; privileged Supabase service credentials must never be shipped to the browser.

---

# 43. Security Requirements

Even though V1 is locally executed, security rules still apply.

### Required

- authenticate protected operations
- authorize project ownership
- validate file types
- enforce upload-size limits
- sanitize filenames/storage paths
- never execute uploaded documents
- never trust client-provided ownership identifiers
- never expose service-role secrets to frontend code
- validate LLM structured output
- avoid rendering unsanitized generated HTML
- isolate prompt/system configuration from user-controlled text
- use parameterized database operations

### Prompt injection consideration

Uploaded educational resources are untrusted input.

The ingestion/RAG pipeline must treat retrieved document text as **data**, not as executable instructions to the system.

The system prompt and generation rules must remain higher priority than retrieved content.

---

# 44. File Processing Security

Uploaded files may contain malformed or malicious content.

V1 document processing must:

- whitelist supported MIME types/extensions
- enforce maximum upload size
- store files in non-executable object storage
- treat extracted text as untrusted content
- prevent path traversal through filenames
- avoid arbitrary command execution from documents

No uploaded resource should be treated as executable code.

---

# 45. Database Design Principles

The database design must follow these rules:

1. PostgreSQL is the system of record.
2. Foreign-key relationships should be explicit.
3. Project ownership must be enforceable.
4. Embeddings live in pgvector.
5. Original files live in Supabase Storage.
6. Question versions must preserve history.
7. Validation results must identify the validated question version.
8. Generation runs must preserve the blueprint/configuration used.
9. Source references must remain traceable to exact resource/chunk provenance.
10. Deletion rules must prevent orphaned AI artifacts.

The full table/column/index design belongs in `DATABASE_DESIGN.md`.

---

# 46. Vector Search Design

V1 begins with:

```text
query embedding
      ↓
pgvector similarity search
      ↓
project filter
      ↓
topic/resource filters where required
      ↓
top-k context
```

The vector index strategy should remain compatible with future dataset growth.

Supabase's pgvector documentation currently recommends HNSW in general for performance and robustness as vector datasets grow. See: https://supabase.com/docs/guides/ai/vector-indexes

Do not prematurely optimize the retrieval system before baseline retrieval quality is measured.

---

# 47. Performance Principles

V1 prioritizes correctness over raw throughput.

Important goals:

- prevent unnecessary LLM calls
- use deterministic validation before semantic validation where possible
- avoid repeated embeddings
- cache immutable resource embeddings
- avoid reprocessing unchanged resources
- use database filters before vector search where useful
- keep generation state visible to the UI

The application is expected to be usable for a single local user at a time.

Concurrent multi-user inference is a V2 concern.

---

# 48. Observability for V1

Full production observability is out of scope.

However, the application should log enough information to debug:

- resource processing failures
- generation failures
- validation failures
- regeneration counts
- model invocation failures
- retrieval failures
- database errors

Logs must not contain:

- OAuth secrets
- service-role keys
- raw authentication tokens
- unnecessary sensitive user data

---

# 49. V1 Non-Goals

The following must not be implemented merely because an AI coding agent thinks they are useful:

- public production deployment
- cloud LLM inference
- model selection UI
- model comparison UI
- research experiment dashboard
- automatic grading
- adaptive learning
- student performance analytics
- numerical solver
- web search/retrieval
- chatbot/tutor mode
- real-time collaborative editing
- multi-tenant scaling infrastructure
- microservices
- distributed queues
- Kubernetes
- Redis unless a demonstrated V1 requirement appears

---

# 50. V2 Direction

Potential V2 architecture:

```text
Hosted Frontend
      ↓
Hosted API
      ↓
Supabase Cloud
      ↓
AI Provider Abstraction
      ├── Cloud LLM API
      └── Remote inference server
```

Possible V2 features:

- public deployment
- multiple simultaneous users
- cloud LLM provider
- hosted inference
- better retrieval/reranking
- numerical questions
- richer collaboration
- additional authentication methods
- research/analytics tooling

These are intentionally not V1 requirements.

---

# 51. Development Principles for AI Coding Agents

Every AI coding agent working on this repository must follow these rules.

## Rule 1 — Do not invent product scope

Do not add features merely because they appear useful.

## Rule 2 — Respect V1 boundaries

Do not introduce cloud LLM APIs, production deployment, grading, adaptive learning, or research dashboards without an explicit product decision.

## Rule 3 — Preserve module boundaries

Do not place database, Ollama, validation, or storage logic directly inside React components.

## Rule 4 — Prefer interfaces around external systems

Use adapters/interfaces for:

- AI providers
- embeddings
- storage
- external authentication integrations

## Rule 5 — Never make the frontend authoritative for security

Authorization must be checked server-side and/or through database policies.

## Rule 6 — Do not trust LLM output

Every generated object must pass schema and semantic validation before becoming an accepted question.

## Rule 7 — Do not hide validation failures

Invalid questions must be rejected, regenerated, or explicitly marked for review.

## Rule 8 — Never silently relax constraints

If requested constraints cannot be satisfied, surface the failure.

## Rule 9 — Preserve provenance

Questions must retain source references to the material used during generation.

## Rule 10 — Preserve version history

Manual edits must not erase previously generated versions or historical validation state.

## Rule 11 — Avoid premature infrastructure

Do not introduce Redis, message brokers, microservices, Kubernetes, or cloud workers without an explicit V2 requirement.

## Rule 12 — Keep AI model-specific code isolated

Changing the local model must not require rewriting unrelated business logic.

---

# 52. Architectural Invariants

The following are hard constraints.

### Invariant 1
Every question belongs to exactly one project.

### Invariant 2
Every generated question has source provenance.

### Invariant 3
Generation is controlled by an explicit blueprint.

### Invariant 4
Bloom, difficulty, style, and question type are separate dimensions.

### Invariant 5
All six Bloom levels are supported.

### Invariant 6
Question generation is resource-grounded.

### Invariant 7
The answer need not exist verbatim in the resource for higher-order questions.

### Invariant 8
Duplicate checking is project-scoped.

### Invariant 9
Duplicate checking can be enabled/disabled before generation.

### Invariant 10
Validation is independent from generation.

### Invariant 11
Validation failure cannot be silently ignored.

### Invariant 12
Failed questions may be regenerated, subject to finite retries.

### Invariant 13
Questions that cannot satisfy constraints after retries may enter manual review.

### Invariant 14
Manual edits invalidate previous validation state.

### Invariant 15
V1 uses a local LLM through Ollama.

### Invariant 16
V1 does not use web search for generation.

### Invariant 17
Original resource files are stored in Supabase Storage rather than Postgres rows.

### Invariant 18
Embeddings are stored in PostgreSQL via pgvector.

### Invariant 19
V1 is local-execution and not publicly deployed.

### Invariant 20
V2 deployment/provider changes must not require redesigning the core product domain.

---

# 53. Architecture Decision Summary

| Decision | V1 Choice |
|---|---|
| Application execution | Localhost |
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + TypeScript + Express |
| Architecture | Modular monolith |
| Repository | Monorepo |
| Database | PostgreSQL |
| Database provider | Supabase Cloud |
| Vector store | pgvector in PostgreSQL |
| Authentication | Supabase Auth |
| OAuth | Google OAuth |
| File storage | Supabase Storage |
| LLM runtime | Ollama locally |
| LLM API | Local only |
| Embeddings | Local |
| RAG | Project-scoped pgvector retrieval |
| API | REST/JSON |
| Question generation | Batch-based configurable generation |
| Blueprint | Multidimensional |
| Bloom | All 6 levels |
| Difficulty | Easy/Medium/Hard |
| Question styles | Multiple independent styles/categories |
| Question types | MCQ, Short Answer, Long Answer |
| Numerical | Not V1 |
| Duplicate scope | Project-level |
| Duplicate toggle | User-controlled per generation |
| Validation | Automatic |
| Failed generation | Regenerate → Manual Review if necessary |
| Question versioning | Yes |
| Research module | No |
| Public deployment | No |
| Cloud LLM API | No |
| Multi-user concurrency | No V1 optimization |

---

# 54. Implementation Order

AI coding agents should implement the architecture in approximately this order:

```text
1. Repository / monorepo foundation
2. Supabase project + schema/migrations
3. Authentication + Google OAuth
4. Project CRUD
5. Resource upload + storage
6. Document extraction/processing
7. Chunking + embeddings
8. pgvector retrieval
9. Topic extraction + editable topic map
10. Blueprint builder
11. Ollama provider abstraction
12. Question planner
13. Structured question generation
14. Deterministic validation
15. Semantic validation
16. Project-level duplicate detection
17. Batch diversity validation
18. Retry/regeneration loop
19. Manual review state
20. Question bank
21. Versioning/editing
22. Source evidence UI
23. End-to-end testing
24. Performance and failure-path testing
```

Do not build the polished dashboard first. The ingestion → retrieval → generation → validation pipeline is the actual product core.

---

# 55. Testing Strategy

Testing should exist at four levels.

## Unit tests

- blueprint distribution logic
- ownership checks
- validation rules
- duplicate similarity utilities
- prompt/response schema parsing
- topic hierarchy operations

## Integration tests

- Supabase database operations
- storage operations
- Ollama adapter
- document processing pipeline
- generation pipeline

## End-to-end tests

Critical flow:

```text
Login
 ↓
Create Project
 ↓
Upload PDF
 ↓
Process Resource
 ↓
Configure Blueprint
 ↓
Generate Questions
 ↓
Validate
 ↓
Review
 ↓
Question Bank
```

## AI evaluation

AI quality evaluation is a research concern and should be designed later as part of the evaluation plan. V1 application code should already preserve the necessary metadata for that evaluation.

---

# 56. Future Research Compatibility Without a Research Module

V1 contains **no research dashboard**.

However, the architecture should preserve enough information to support later research:

- generation run ID
- model ID/version
- blueprint
- retrieved chunks
- source references
- validation outcomes
- retry counts
- duplicate decisions
- timestamps

This metadata is stored because it is part of reproducibility and debugging, not because users need a research interface.

---

# 57. What an AI Coding Agent Must Not Assume

Do not assume:

- users are teachers
- users are students
- every resource includes a syllabus
- every answer exists in the resource
- more retrieved context is always better
- an LLM-generated validation claim is automatically correct
- duplicate questions are only exact string matches
- difficulty equals Bloom level
- question type equals cognitive level
- a project can use another project's resources
- a failed question should be accepted to satisfy quantity
- deployment is part of V1
- cloud LLM APIs are available

---

# 58. Definition of Done for V1 Architecture

The implementation conforms to this document when:

1. Users can authenticate with Google through Supabase Auth.
2. Users can create isolated projects.
3. Users can upload PDF/DOCX/PPTX resources.
4. Resources are stored in Supabase Storage.
5. Resources are processed into traceable chunks.
6. Local embeddings are stored in pgvector.
7. Users can review/edit the inferred topic map.
8. Users can configure a multidimensional blueprint.
9. The planner translates the blueprint into concrete generation targets.
10. Ollama generates structured candidate questions locally.
11. Generated questions are grounded in project resources.
12. Validation runs independently of generation.
13. Duplicate checking can be toggled before generation.
14. Duplicate checking is project-scoped.
15. Batch diversity is checked.
16. Failed questions are regenerated rather than silently accepted.
17. Unresolved failures can enter manual review.
18. Accepted questions are stored with source provenance.
19. Manual edits invalidate stale validation state.
20. V1 remains a localhost application with local LLM inference.

---

# 59. External Technical References

These are implementation references, not alternative architectural requirements.

- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase pgvector: https://supabase.com/docs/guides/database/extensions/pgvector
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase Storage uploads: https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Supabase local development: https://supabase.com/docs/guides/local-development
- Supabase vector indexes: https://supabase.com/docs/guides/ai/vector-indexes
- Ollama API: https://docs.ollama.com/api

---

# 60. Final Architecture Statement

V1 is a **localhost-hosted React + Node modular monolith backed by Supabase Cloud for authentication, PostgreSQL, pgvector and file storage, with all LLM inference and embedding generation performed locally through Ollama**.

The core technical pipeline is:

```text
Authenticated User
      ↓
Project
      ↓
Resource Upload
      ↓
Document Processing
      ↓
Topic Mapping
      ↓
Question Blueprint
      ↓
Question Planning
      ↓
Project-Scoped RAG
      ↓
Local Ollama Generation
      ↓
Deterministic Validation
      ↓
Semantic Validation
      ↓
Duplicate Detection
      ↓
Batch Diversity Check
      ↓
Regeneration if Required
      ↓
Manual Review if Unresolved
      ↓
Accepted Question Bank
```

This architecture is intentionally narrow for V1, technically credible for a final-year major project, free of paid LLM inference, and capable of evolving into a cloud-deployed V2 without forcing the core domain model to be rewritten.
