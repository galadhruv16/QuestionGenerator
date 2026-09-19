# Syllabus-Grounded Controllable Question Generation
## API Specification — V1

**Document status:** Frozen for V1 implementation  
**Audience:** Developers, AI coding agents, reviewers, and project team  
**API style:** REST + JSON  
**Base path:** `/api/v1`  
**Application execution:** Localhost  
**Managed services:** Supabase Cloud  
**Authentication:** Supabase Auth + Google OAuth  
**LLM:** Local Ollama  
**Database:** PostgreSQL + pgvector via Supabase  

---

# 1. Purpose

This document is the authoritative HTTP API contract for V1.

It is derived from:

1. `README.md` / PRD
2. `SYSTEM_DESIGN_README.md`
3. `DATABASE_DESIGN.md`

The API exposes product-level domain operations rather than mirroring database tables mechanically.

Example:

```text
GOOD
POST /api/v1/projects/:projectId/questions/:questionId/revalidate

BAD
POST /api/v1/validation_checks
```

The database may contain a `validation_checks` table, but the frontend should request the business operation: revalidate a question.

---

# 2. V1 API Principles

## 2.1 REST + JSON

All business API endpoints use REST semantics and JSON bodies unless explicitly documented otherwise.

## 2.2 Versioning

All endpoints are under:

```text
/api/v1
```

Breaking API changes require a new version.

## 2.3 Authentication

Protected API endpoints require a valid authenticated Supabase session.

The React frontend uses Supabase Auth for Google OAuth and session management.

The Node backend verifies the authenticated identity before performing protected operations.

## 2.4 Authorization

Every project-scoped request must verify:

```text
Authenticated user
        ↓
Owns project
        ↓
Requested object belongs to project
```

Client-provided ownership fields must never be trusted.

Supabase Row Level Security is an additional database-level protection.

## 2.5 Project isolation

A user may access only resources belonging to their own projects.

This applies to:

- resources
- chunks
- topics
- presets
- blueprints
- generation runs
- generation attempts
- questions
- question versions
- validation results
- duplicate matches

## 2.6 V1 execution model

The Node API and React application run locally.

LLM inference and embeddings run locally through Ollama/local embedding services.

Supabase Cloud provides managed application services.

V1 does not depend on a cloud LLM API.

---

# 3. Local API Base URL

```text
http://localhost:<API_PORT>/api/v1
```

The port is configured through environment variables and must not be hardcoded in frontend components.

---

# 4. Authentication Model

Supabase Auth manages:

- Google OAuth
- identity
- sessions
- access tokens
- refresh tokens

The browser sends the authenticated access token to the Node API:

```http
Authorization: Bearer <access-token>
```

The backend resolves the authenticated Supabase user ID.

The backend must never accept `owner_id` from the client as an authorization mechanism.

---

# 5. User API

## 5.1 Get current user

```http
GET /api/v1/me
```

Authentication: required.

### Response

```json
{
  "data": {
    "id": "uuid",
    "display_name": "User Name",
    "avatar_url": null,
    "email": "user@example.com"
  }
}
```

## 5.2 Update profile

```http
PATCH /api/v1/me
```

### Request

```json
{
  "display_name": "Updated Name",
  "avatar_url": "https://..."
}
```

Authentication-provider configuration remains a Supabase Auth responsibility.

---

# 6. Standard Response Contract

## Single resource

```json
{
  "data": {
    "id": "uuid"
  }
}
```

## Collection

```json
{
  "data": [],
  "meta": {
    "next_cursor": "opaque-cursor",
    "has_more": true
  }
}
```

The API must not expose internal database implementation details unnecessarily.

---

# 7. Error Contract

All errors use:

```json
{
  "error": {
    "code": "RESOURCE_NOT_READY",
    "message": "The resource has not finished processing.",
    "details": {}
  }
}
```

## Standard error codes

| Code | HTTP |
|---|---:|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHENTICATED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `FILE_TOO_LARGE` | 413 |
| `UNSUPPORTED_FILE` | 415 |
| `UNPROCESSABLE_RESOURCE` | 422 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |
| `AI_PROVIDER_ERROR` | 502 |
| `AI_TIMEOUT` | 504 |

`code` is machine-readable. `message` is user-safe. Internal stack traces and secrets must never be returned.

---

# 8. Cursor Pagination

Collection endpoints use cursor-based pagination.

Example:

```http
GET /api/v1/projects?limit=20
```

Next page:

```http
GET /api/v1/projects?limit=20&cursor=opaque-cursor
```

Rules:

- cursor values are opaque
- clients must not parse cursor contents
- server enforces maximum page size
- default limit should be about 20
- maximum limit should be about 100

---

# 9. Reference Data API

Reference data must be database-backed and exposed through an API instead of being hardcoded into the frontend.

```http
GET /api/v1/reference/questioning
```

### Response

```json
{
  "data": {
    "bloom_levels": [
      { "slug": "remember", "name": "Remember", "display_order": 1 },
      { "slug": "understand", "name": "Understand", "display_order": 2 },
      { "slug": "apply", "name": "Apply", "display_order": 3 },
      { "slug": "analyze", "name": "Analyze", "display_order": 4 },
      { "slug": "evaluate", "name": "Evaluate", "display_order": 5 },
      { "slug": "create", "name": "Create", "display_order": 6 }
    ],
    "difficulty_levels": [
      { "slug": "easy", "name": "Easy" },
      { "slug": "medium", "name": "Medium" },
      { "slug": "hard", "name": "Hard" }
    ],
    "question_types": [
      { "slug": "mcq", "name": "MCQ" },
      { "slug": "short_answer", "name": "Short Answer" },
      { "slug": "long_answer", "name": "Long Answer" }
    ],
    "question_styles": [
      { "slug": "conceptual", "name": "Conceptual" },
      { "slug": "comparative", "name": "Comparative" },
      { "slug": "application", "name": "Application" },
      { "slug": "scenario", "name": "Scenario" },
      { "slug": "case_based", "name": "Case-based" },
      { "slug": "analytical", "name": "Analytical" },
      { "slug": "cause_effect", "name": "Cause-effect" },
      { "slug": "evaluative", "name": "Evaluative" },
      { "slug": "design_synthesis", "name": "Design/Synthesis" }
    ]
  }
}
```

---

# 10. Projects API

Every generation belongs to exactly one project.

## List projects

```http
GET /api/v1/projects
```

Query:

```text
limit
cursor
include_archived=true|false
```

Default `include_archived=false`.

## Create project

```http
POST /api/v1/projects
```

```json
{
  "name": "Operating Systems",
  "description": "Semester 7 preparation"
}
```

Returns `201 Created`.

## Get project

```http
GET /api/v1/projects/:projectId
```

## Update project

```http
PATCH /api/v1/projects/:projectId
```

```json
{
  "name": "Operating Systems - Semester 7",
  "description": "Updated description"
}
```

## Archive project

```http
POST /api/v1/projects/:projectId/archive
```

No normal physical deletion.

---

# 11. Resource API

Supported V1 formats:

```text
PDF
DOCX
PPT
PPTX
```

PYQs and syllabi are represented as `resource_kind` values, not separate entities.

## 11.1 Upload initialization

```http
POST /api/v1/projects/:projectId/resources/upload-init
```

### Request

```json
{
  "filename": "Unit-2-Notes.pdf",
  "mime_type": "application/pdf",
  "file_size_bytes": 5829134,
  "resource_kind": "STUDY_MATERIAL"
}
```

The backend validates project ownership, supported type, size, and project state.

It generates the Storage path server-side.

### Response

Implementation-specific upload authorization may be returned, conceptually:

```json
{
  "data": {
    "resource_id": "uuid",
    "storage_path": "generated/server/path/file.pdf",
    "upload": {
      "method": "POST",
      "url": "...",
      "token": "..."
    },
    "expires_at": "..."
  }
}
```

The browser uploads directly to Supabase Storage.

## 11.2 Finalize resource

```http
POST /api/v1/projects/:projectId/resources
```

```json
{
  "resource_id": "uuid",
  "original_filename": "Unit-2-Notes.pdf",
  "resource_kind": "STUDY_MATERIAL",
  "checksum_sha256": "optional"
}
```

The server verifies the uploaded object exists and matches the expected resource.

Returns `201 Created`.

## 11.3 List resources

```http
GET /api/v1/projects/:projectId/resources
```

Query:

```text
limit
cursor
status
resource_kind
include_archived
```

## 11.4 Get resource

```http
GET /api/v1/projects/:projectId/resources/:resourceId
```

Returns metadata, not binary file contents.

## 11.5 Get processing status

```http
GET /api/v1/projects/:projectId/resources/:resourceId/status
```

Example:

```json
{
  "data": {
    "resource_id": "uuid",
    "resource_status": "PROCESSING",
    "processing_run": {
      "id": "uuid",
      "status": "RUNNING",
      "stage": "EMBEDDING",
      "percent": 72
    }
  }
}
```

`percent` is best-effort and must not imply exact completion unless the processor can calculate it accurately.

## 11.6 Reprocess resource

```http
POST /api/v1/projects/:projectId/resources/:resourceId/reprocess
```

Creates a new processing run while preserving historical processing runs.

## 11.7 Archive resource

```http
POST /api/v1/projects/:projectId/resources/:resourceId/archive
```

No normal physical deletion.

---

# 12. Topic Map API

The topic map is project-scoped, editable, and authoritative after user editing.

## List topics

```http
GET /api/v1/projects/:projectId/topics
```

## Create topic

```http
POST /api/v1/projects/:projectId/topics
```

```json
{
  "name": "Deadlocks",
  "parent_id": null,
  "sort_order": 3
}
```

## Update topic

```http
PATCH /api/v1/projects/:projectId/topics/:topicId
```

Editable fields:

```text
name
description
parent_id
sort_order
```

A rename does not rewrite historical question versions.

## Archive topic

```http
POST /api/v1/projects/:projectId/topics/:topicId/archive
```

Historical questions and provenance remain intact.

## Reorder topics

```http
POST /api/v1/projects/:projectId/topics/reorder
```

```json
{
  "items": [
    { "id": "topic-1", "parent_id": null, "sort_order": 1 },
    { "id": "topic-2", "parent_id": "topic-1", "sort_order": 1 }
  ]
}
```

---

# 13. Preset API

Presets are reusable generation configurations.

## List presets

```http
GET /api/v1/projects/:projectId/presets
```

## Create preset

```http
POST /api/v1/projects/:projectId/presets
```

```json
{
  "name": "High Order Thinking",
  "description": "Apply/analyze/evaluate focused",
  "configuration": {
    "question_count": 10,
    "bloom": {
      "apply": 30,
      "analyze": 50,
      "evaluate": 20
    },
    "difficulty": {
      "medium": 20,
      "hard": 80
    },
    "styles": {
      "scenario": 50,
      "analytical": 50
    },
    "types": {
      "mcq": 50,
      "long_answer": 50
    },
    "duplicate_policy": "PREVENT"
  }
}
```

The server validates this structure against the canonical blueprint schema.

## Update preset

```http
PATCH /api/v1/projects/:projectId/presets/:presetId
```

## Archive preset

```http
POST /api/v1/projects/:projectId/presets/:presetId/archive
```

---

# 14. Blueprint API

A blueprint is a concrete generation configuration.

## List blueprints

```http
GET /api/v1/projects/:projectId/blueprints
```

## Create blueprint

```http
POST /api/v1/projects/:projectId/blueprints
```

Example configuration:

```json
{
  "name": "Semester Exam Practice",
  "configuration": {
    "question_count": 20,
    "topics": {
      "topic-id-1": 40,
      "topic-id-2": 60
    },
    "bloom": {
      "apply": 30,
      "analyze": 50,
      "evaluate": 20
    },
    "difficulty": {
      "medium": 40,
      "hard": 60
    },
    "styles": {
      "scenario": 40,
      "analytical": 40,
      "comparative": 20
    },
    "types": {
      "mcq": 50,
      "short_answer": 25,
      "long_answer": 25
    },
    "duplicate_policy": "PREVENT"
  }
}
```

Server validation must verify:

- each distribution is valid
- selected reference values exist
- selected topics belong to the project
- question count is valid
- unsupported V1 question types are rejected

## Get blueprint

```http
GET /api/v1/projects/:projectId/blueprints/:blueprintId
```

## Update blueprint

```http
PATCH /api/v1/projects/:projectId/blueprints/:blueprintId
```

Updating a blueprint must never modify historical generation-run snapshots.

---

# 15. Generation Run API

Generation is a persistent asynchronous job.

## 15.1 Start generation

```http
POST /api/v1/projects/:projectId/generation-runs
```

Recommended request:

```json
{
  "blueprint_id": "uuid",
  "request_id": "optional-client-generated-uuid"
}
```

An inline configuration may be supported for unsaved custom generation:

```json
{
  "configuration": {}
}
```

The backend creates:

- generation run
- immutable blueprint snapshot
- generation plan items

### Response

```text
202 Accepted
```

```json
{
  "data": {
    "id": "generation-run-uuid",
    "status": "QUEUED",
    "requested_count": 20,
    "accepted_count": 0,
    "review_count": 0
  }
}
```

## 15.2 Get generation run

```http
GET /api/v1/projects/:projectId/generation-runs/:runId
```

Example:

```json
{
  "data": {
    "id": "uuid",
    "status": "VALIDATING",
    "requested_count": 20,
    "accepted_count": 12,
    "review_count": 0,
    "progress": {
      "completed_plan_items": 12,
      "total_plan_items": 20
    },
    "created_at": "...",
    "started_at": "...",
    "completed_at": null
  }
}
```

## 15.3 List generation runs

```http
GET /api/v1/projects/:projectId/generation-runs
```

Query:

```text
limit
cursor
status
```

## 15.4 Get generation plan

```http
GET /api/v1/projects/:projectId/generation-runs/:runId/plan
```

## 15.5 Get generation attempts

```http
GET /api/v1/projects/:projectId/generation-runs/:runId/attempts
```

This is primarily diagnostic and should return safe metadata rather than raw prompt internals by default.

## 15.6 No cancel endpoint

V1 does not implement generation cancellation.

A generation run ends in completion, failure, or manual-review state.

---

# 16. Question Bank API

## 16.1 List questions

```http
GET /api/v1/projects/:projectId/questions
```

Query parameters:

```text
limit
cursor
topic_id
question_type
bloom_level
difficulty
style
status
generation_run_id
search
include_archived
```

## 16.2 Get current question

```http
GET /api/v1/projects/:projectId/questions/:questionId
```

Returns the current active version plus relevant metadata.

## 16.3 Get versions

```http
GET /api/v1/projects/:projectId/questions/:questionId/versions
```

Returns historical versions newest-first.

## 16.4 Get a specific version

```http
GET /api/v1/projects/:projectId/questions/:questionId/versions/:versionId
```

---

# 17. Question Editing and Versioning

## 17.1 Edit question

```http
PATCH /api/v1/projects/:projectId/questions/:questionId
```

Example:

```json
{
  "question_text": "Updated question text",
  "bloom_level": "analyze",
  "difficulty": "hard",
  "style": "scenario",
  "topic_id": "uuid",
  "options": [
    { "index": 0, "text": "Option A", "is_correct": false },
    { "index": 1, "text": "Option B", "is_correct": true }
  ]
}
```

Rules:

1. Creates a new `question_version`.
2. Never overwrites the previous version.
3. Makes previous validation state stale/outdated.
4. Does not automatically invoke semantic validation.
5. The current version can be explicitly revalidated.

Question-type-specific fields are validated server-side.

---

# 18. Validation API

## 18.1 Revalidate question

```http
POST /api/v1/projects/:projectId/questions/:questionId/revalidate
```

### Response

```text
202 Accepted
```

```json
{
  "data": {
    "validation_run_id": "uuid",
    "status": "RUNNING"
  }
}
```

## 18.2 Get latest validation

```http
GET /api/v1/projects/:projectId/questions/:questionId/validation
```

Example:

```json
{
  "data": {
    "overall_result": "FAIL",
    "checks": [
      {
        "type": "GROUNDING",
        "result": "PASS",
        "score": 0.93,
        "reason": "Question concepts are supported by source evidence."
      },
      {
        "type": "BLOOM_ALIGNMENT",
        "result": "FAIL",
        "score": 0.41,
        "reason": "Requested Analyze; predicted demand is Understand."
      },
      {
        "type": "DUPLICATE",
        "result": "PASS"
      }
    ]
  }
}
```

The API exposes concise validation evidence, not hidden chain-of-thought.

---

# 19. Source Provenance API

```http
GET /api/v1/projects/:projectId/questions/:questionId/source
```

Example:

```json
{
  "data": [
    {
      "resource": {
        "id": "uuid",
        "filename": "Unit-2-Notes.pdf"
      },
      "chunk_id": "uuid",
      "page_number": 42,
      "section_title": "Deadlock Avoidance",
      "evidence_text": "..."
    }
  ]
}
```

Only source material within the authenticated user's project is returned.

---

# 20. Question Regeneration

```http
POST /api/v1/projects/:projectId/questions/:questionId/regenerate
```

Regeneration must preserve the original question/version and create a replacement candidate tied to the existing generation context.

It must not silently weaken the original constraints.

---

# 21. Review API

## List manual-review items

```http
GET /api/v1/projects/:projectId/review-items
```

Returns unresolved questions requiring human action.

## Approve

```http
POST /api/v1/projects/:projectId/questions/:questionId/approve
```

Approval does **not** change automated validation results to `PASS`.

Instead the system records that the user deliberately overrode the validation outcome.

Conceptually:

```text
validation = FAIL
question availability = APPROVED
resolution = USER_APPROVED
```

## Reject

```http
POST /api/v1/projects/:projectId/questions/:questionId/reject
```

The question remains historically stored but is excluded from the active question bank.

---

# 22. Archive Question

```http
POST /api/v1/projects/:projectId/questions/:questionId/archive
```

No physical deletion.

All versions, validation history, provenance, and generation history remain available.

Archived questions are excluded from normal active duplicate comparisons.

---

# 23. Duplicate Policy

The blueprint stores:

```text
PREVENT
ALLOW
```

When `PREVENT` is selected, the candidate is checked against:

1. other questions in the current generation batch
2. active questions in the same project

It is not checked across other projects owned by the same user.

When `ALLOW` is selected, similarity may still be recorded internally, but duplicate detection must not reject the candidate.

---

# 24. Internal AI Service Contracts

The following are internal backend services, not public frontend APIs:

```text
retrieveRelevantChunks()
buildQuestionPlan()
generateCandidate()
validateGrounding()
validateBloom()
validateDifficulty()
validateStyle()
calculateDuplicateSimilarity()
evaluateBatchDiversity()
invokeOllama()
embedText()
```

The browser must never call Ollama directly.

---

# 25. Retrieval Service Contract

Conceptual TypeScript interface:

```ts
interface RetrievalService {
  retrieve(request: RetrievalRequest): Promise<RetrievedContext[]>;
}

interface RetrievalRequest {
  projectId: string;
  topicId?: string;
  query: string;
  topK: number;
  resourceIds?: string[];
}
```

Every retrieved result must preserve:

```text
project_id
resource_id
chunk_id
text
page/slide provenance
similarity score
```

The service must never retrieve another project's chunks.

---

# 26. AI Provider Contract

Ollama must be hidden behind an abstraction.

Conceptual interface:

```ts
interface AIProvider {
  generateQuestion(
    request: QuestionGenerationRequest
  ): Promise<QuestionCandidate>;

  embedText(
    text: string
  ): Promise<number[]>;
}
```

V1 implementation:

```text
OllamaProvider
```

Future providers may be added without redesigning the API resource model.

The frontend never knows which AI provider is active.

---

# 27. Request Validation

Use a strict runtime schema validation layer such as Zod or an equivalent library.

The API must validate before service execution:

- UUIDs
- reference slugs/IDs
- question count
- percentages
- topic IDs
- project ownership
- archive state
- file type
- file size
- request body shape

LLM outputs require a separate structured-output validation layer.

---

# 28. Idempotency

A general distributed idempotency system is not required for V1.

Generation creation should nevertheless avoid accidental duplicate runs from double-clicks or client retries.

An optional client-generated `request_id` can be accepted when starting generation.

If the same request ID is submitted again, the API should return the existing generation run instead of starting another expensive run.

---

# 29. Transaction Boundaries

Use database transactions when multiple relational changes must be atomic.

### Accept question

```text
BEGIN
  create question
  create question_version
  create options if MCQ
  create source references
  update current_version
COMMIT
```

### Complete validation

```text
BEGIN
  create validation_run
  create validation_checks
  update question status
COMMIT
```

AI inference itself does not participate in a PostgreSQL transaction.

---

# 30. State Rules

## Resource generation readiness

Generation is allowed only when required resources are `READY`.

If no usable resources exist, return:

```text
UNPROCESSABLE_RESOURCE
```

If selected resources are still processing, return a resource-readiness conflict.

## Topic state

Blueprints referencing archived topics are invalid for new generation runs.

Do not silently replace archived topics with another topic.

## Count integrity

Always preserve:

```text
requested_count
accepted_count
review_count
```

Example:

```text
Requested = 10
Accepted  = 7
Review    = 3
```

The API must never falsify the accepted count to satisfy the requested count.

---

# 31. Security Rules

Required:

- authenticate protected endpoints
- authorize project ownership
- use parameterized database access
- never expose Supabase service-role credentials
- never expose Ollama directly to the browser
- validate file type and size
- never execute uploaded resources
- validate LLM output
- sanitize generated HTML if ever rendered
- do not expose raw OAuth tokens
- do not expose stack traces
- do not expose hidden chain-of-thought
- treat retrieved document text as untrusted data

Retrieved content must never override system-level generation rules.

---

# 32. File Upload Security

The backend must:

- whitelist PDF/DOCX/PPT/PPTX
- enforce size limits
- generate Storage paths server-side
- prevent path traversal
- verify upload ownership
- verify uploaded object before finalization
- never execute uploaded content

---

# 33. Logging

Safe request logs may contain:

```text
request_id
endpoint
user_id
project_id
HTTP status
duration
generation_run_id
error code
```

Never log:

- OAuth secrets
- access/refresh tokens
- service-role keys
- complete uploaded documents
- unnecessary personal data
- hidden chain-of-thought

---

# 34. Main Frontend Flows

## Login

```text
React
 ↓
Supabase Auth
 ↓
Google OAuth
 ↓
Authenticated session
 ↓
Node API
```

## Upload

```text
React
 ↓
POST /resources/upload-init
 ↓
Direct Supabase Storage upload
 ↓
POST /resources
 ↓
PROCESSING
 ↓
GET /resources/:id/status
 ↓
READY
```

## Generate

```text
React
 ↓
POST /generation-runs
 ↓
202 Accepted
 ↓
Poll GET /generation-runs/:runId
 ↓
PLANNING
 ↓
GENERATING
 ↓
VALIDATING
 ↓
COMPLETED / NEEDS_REVIEW
 ↓
GET /questions
```

## Edit and revalidate

```text
PATCH /questions/:id
 ↓
new question version
 ↓
validation becomes stale
 ↓
POST /questions/:id/revalidate
 ↓
202 Accepted
 ↓
GET /questions/:id/validation
```

---

# 35. API-to-Database Mapping

| API Domain | Internal persistence |
|---|---|
| User | `profiles` + Supabase Auth |
| Projects | `projects` |
| Resources | `resources`, `resource_processing_runs`, `resource_chunks` |
| Topics | `topics`, `chunk_topics` |
| Presets | `generation_presets` |
| Blueprints | `generation_blueprints` |
| Generation | `generation_runs`, `generation_plan_items`, `generation_attempts` |
| Questions | `questions`, `question_versions`, `question_options` |
| Provenance | `question_source_refs` |
| Validation | `validation_runs`, `validation_checks` |
| Duplicate detection | `duplicate_matches` |

The API must use domain services/repositories rather than exposing raw table CRUD to the frontend.

---

# 36. V1 Endpoint Inventory

```text
USER
GET    /api/v1/me
PATCH  /api/v1/me

REFERENCE
GET    /api/v1/reference/questioning

PROJECTS
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:projectId
PATCH  /api/v1/projects/:projectId
POST   /api/v1/projects/:projectId/archive

RESOURCES
GET    /api/v1/projects/:projectId/resources
POST   /api/v1/projects/:projectId/resources/upload-init
POST   /api/v1/projects/:projectId/resources
GET    /api/v1/projects/:projectId/resources/:resourceId
GET    /api/v1/projects/:projectId/resources/:resourceId/status
POST   /api/v1/projects/:projectId/resources/:resourceId/reprocess
POST   /api/v1/projects/:projectId/resources/:resourceId/archive

TOPICS
GET    /api/v1/projects/:projectId/topics
POST   /api/v1/projects/:projectId/topics
PATCH  /api/v1/projects/:projectId/topics/:topicId
POST   /api/v1/projects/:projectId/topics/:topicId/archive
POST   /api/v1/projects/:projectId/topics/reorder

PRESETS
GET    /api/v1/projects/:projectId/presets
POST   /api/v1/projects/:projectId/presets
PATCH  /api/v1/projects/:projectId/presets/:presetId
POST   /api/v1/projects/:projectId/presets/:presetId/archive

BLUEPRINTS
GET    /api/v1/projects/:projectId/blueprints
POST   /api/v1/projects/:projectId/blueprints
GET    /api/v1/projects/:projectId/blueprints/:blueprintId
PATCH  /api/v1/projects/:projectId/blueprints/:blueprintId

GENERATION
POST   /api/v1/projects/:projectId/generation-runs
GET    /api/v1/projects/:projectId/generation-runs
GET    /api/v1/projects/:projectId/generation-runs/:runId
GET    /api/v1/projects/:projectId/generation-runs/:runId/plan
GET    /api/v1/projects/:projectId/generation-runs/:runId/attempts

QUESTIONS
GET    /api/v1/projects/:projectId/questions
GET    /api/v1/projects/:projectId/questions/:questionId
PATCH  /api/v1/projects/:projectId/questions/:questionId
GET    /api/v1/projects/:projectId/questions/:questionId/versions
GET    /api/v1/projects/:projectId/questions/:questionId/versions/:versionId
POST   /api/v1/projects/:projectId/questions/:questionId/revalidate
GET    /api/v1/projects/:projectId/questions/:questionId/validation
GET    /api/v1/projects/:projectId/questions/:questionId/source
POST   /api/v1/projects/:projectId/questions/:questionId/regenerate
POST   /api/v1/projects/:projectId/questions/:questionId/approve
POST   /api/v1/projects/:projectId/questions/:questionId/reject
POST   /api/v1/projects/:projectId/questions/:questionId/archive

REVIEW
GET    /api/v1/projects/:projectId/review-items
```

---

# 37. V1 Non-Endpoints

Do not create frontend-facing endpoints such as:

```text
POST /llm/generate
POST /ollama/*
POST /rag/search
POST /embeddings
POST /validation/run
POST /duplicate-check
POST /diversity-check
POST /database/*
```

These are internal application services.

---

# 38. V1 Non-Goals

The API must not introduce endpoints for:

- automatic grading
- adaptive learning
- student performance analytics
- tutoring/chatbot mode
- web search retrieval
- numerical solver
- public deployment infrastructure
- model comparison UI
- research experiment dashboard
- real-time collaboration
- distributed job queues
- multi-tenant production scaling

These remain outside V1.

---

# 39. Implementation Order

Recommended order:

```text
1. API bootstrap
2. Auth middleware
3. Global error handling
4. Request validation
5. User profile
6. Projects
7. Resource upload-init/finalize
8. Resource processing/status
9. Topics
10. Reference data
11. Presets
12. Blueprints
13. Generation-run creation/status
14. Generation plan/attempt visibility
15. Question list/filter
16. Question detail/versioning
17. Question editing
18. Validation/revalidation
19. Review/approve/reject
20. Provenance
21. Regeneration
22. Archive actions
23. Cursor pagination hardening
24. RLS/authorization tests
25. End-to-end API tests
```

The ingestion → retrieval → generation → validation path should be implemented before polishing the full API surface.

---

# 40. AI Coding Agent Rules

1. Follow `/api/v1` for all business endpoints.
2. Do not invent new product scope.
3. Do not mirror database tables blindly as REST resources.
4. Authenticate every protected endpoint.
5. Verify project ownership server-side.
6. Preserve project isolation.
7. Do not expose Supabase service-role keys.
8. Do not expose Ollama to the browser.
9. Use direct Supabase Storage uploads for resource binaries.
10. Use cursor pagination for collection endpoints.
11. Generation must be represented as a persistent asynchronous run.
12. Do not implement generation cancellation in V1.
13. Question edits create versions; they do not overwrite history.
14. Question edits do not automatically invoke semantic revalidation.
15. Revalidation is explicit.
16. Validation failures remain historically visible even when a user approves a question.
17. Never silently weaken user-selected constraints.
18. Do not create teacher/student roles.
19. Do not add grading/adaptive-learning APIs.
20. Keep AI internals behind backend service interfaces.
21. Use runtime request schemas.
22. Keep API DTOs separate from raw persistence models.
23. Never expose chain-of-thought.
24. Keep error codes stable.
25. Preserve compatibility with `README.md`, `SYSTEM_DESIGN_README.md`, and `DATABASE_DESIGN.md`.

---

# 41. Definition of Done

The V1 API is complete when:

1. Google-authenticated users can access their profile.
2. Users can create and manage projects.
3. Project ownership is enforced.
4. Resources can be uploaded directly to Supabase Storage.
5. Resource processing state can be queried.
6. Topics can be created and edited.
7. Reference data comes from PostgreSQL.
8. Presets and blueprints can be persisted.
9. Generation runs are asynchronous/persistent.
10. Generation progress can be polled.
11. Questions can be listed and filtered.
12. Questions retain version history.
13. Editing creates a new version.
14. Validation can be explicitly triggered.
15. Validation results and concise evidence are retrievable.
16. Source provenance is retrievable.
17. Manual-review items can be listed.
18. Questions can be approved, rejected, regenerated, or archived.
19. Cursor pagination works consistently.
20. Error responses use stable machine-readable codes.
21. Internal AI services are not exposed directly to the browser.
22. API behavior respects all V1 product and architectural constraints.

---

# 42. Final API Architecture

```text
                         BROWSER
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
     Supabase Auth                  Node REST API
     Google OAuth                   /api/v1/*
             │                             │
             │                     ┌───────┴─────────┐
             │                     │                 │
             │                     ▼                 ▼
             │                Domain Services    AI Services
             │                     │                 │
             │                     │          ┌──────┴──────┐
             │                     │          │ Retrieval   │
             │                     │          │ Generation  │
             │                     │          │ Validation  │
             │                     │          │ Ollama      │
             │                     │          └──────┬──────┘
             │                     │                 │
             └──────────────┬──────┴─────────────────┘
                            │
                            ▼
                    Supabase / PostgreSQL
                    + pgvector + Storage
```

The central contract is:

> **Supabase manages identity and persistent application infrastructure; Node owns domain behavior and API orchestration; the AI pipeline remains behind Node; Ollama stays local; the browser never orchestrates the AI system directly.**
