# Syllabus-Grounded Controllable Question Generation

## Database Design Specification — V1

**Document status:** Frozen for V1 implementation  
**Audience:** Developers, AI coding agents, database designers, reviewers, project team  
**Purpose:** Authoritative persistence/data-model specification for V1  
**Database:** PostgreSQL via Supabase Cloud  
**Vector storage:** pgvector  
**Authentication:** Supabase Auth + Google OAuth  
**File storage:** Supabase Storage  
**Application execution:** Localhost  
**LLM execution:** Local Ollama  

---

# 1. Document Purpose

This document is the authoritative database/data-model contract for V1.

It is derived from the frozen PRD and System Design documents. AI coding agents must not invent alternative entity structures when implementing persistence unless an explicit project decision changes this document.

### Source-of-truth priority

When data-model requirements conflict, use this order:

1. Explicitly approved project decisions
2. This Database Design document
3. System Design / Architecture document
4. PRD
5. Implementation convenience

Implementation convenience must never silently change the domain model.

---

# 2. Data Architecture Summary

The V1 data layer consists of seven logical areas:

```text
DATABASE
│
├── Identity
│   └── profiles
│
├── Project & Resource Management
│   ├── projects
│   ├── resources
│   ├── resource_processing_runs
│   └── resource_chunks
│
├── Knowledge Structure
│   ├── topics
│   └── chunk_topics
│
├── Generation Configuration
│   ├── generation_presets
│   └── generation_blueprints
│
├── Generation Execution
│   ├── generation_runs
│   ├── generation_plan_items
│   └── generation_attempts
│
├── Question Bank
│   ├── questions
│   ├── question_versions
│   ├── question_options
│   └── question_source_refs
│
└── Quality / Validation
    ├── validation_runs
    ├── validation_checks
    └── duplicate_matches
```

Reference/configuration data is stored in:

```text
bloom_levels
difficulty_levels
question_types
question_styles
```

---

# 3. Core Domain Invariants

These rules are mandatory.

1. Every authenticated application user is represented by `profiles` and linked to `auth.users`.
2. Every project belongs to exactly one authenticated user.
3. Every resource belongs to exactly one project.
4. Every generation run belongs to exactly one project.
5. Every question belongs to exactly one project.
6. A project's resources, topics, question bank, generation runs and embeddings are isolated from other projects.
7. Duplicate detection is project-scoped, never globally user-scoped.
8. Duplicate detection can be enabled or disabled per generation request.
9. Original uploaded files are stored in Supabase Storage, not PostgreSQL rows.
10. Extracted chunks and their embeddings are stored in PostgreSQL/pgvector.
11. A chunk may belong to multiple topics.
12. A question is a logical object; mutable content lives in `question_versions`.
13. Every validation result is tied to a specific `question_version`.
14. Source provenance is tied to the `question_version` that used the source evidence.
15. Editing a question creates a new version and makes previous validation state stale.
16. Generation runs preserve a configuration snapshot independent of later blueprint edits.
17. Failed candidates are not accepted merely to satisfy the requested question count.
18. Unresolved generation failures may enter manual review.
19. Resources and questions are archived rather than hard-deleted by normal application actions.
20. Foreign-key relationships must prevent cross-project references.
21. V1 uses PostgreSQL as the system of record.
22. V1 does not require a separate vector database.
23. V1 does not store student answers, grading results, adaptive-learning state, or research-dashboard data.

---

# 4. PostgreSQL and Supabase Responsibilities

## Supabase Auth

Supabase Auth owns:

- authentication identity
- Google OAuth identity
- session management
- password/social-auth credentials, where applicable

The application must not duplicate passwords or OAuth tokens in custom tables.

## `profiles`

The application-owned profile table stores only user-facing application metadata.

## PostgreSQL

PostgreSQL stores all structured application data, generation metadata, validation metadata, provenance and embeddings.

## Supabase Storage

Storage holds the original PDF/DOCX/PPT/PPTX files.

The database stores storage metadata/path, not the file binary.

---

# 5. UUID Strategy

All application primary keys should use UUIDs generated server/database side.

Recommended PostgreSQL type:

```sql
uuid
```

The system should prefer `gen_random_uuid()` (via `pgcrypto`) unless Supabase/project defaults provide an equivalent UUID generation mechanism.

Do not expose sequential integer IDs as public identifiers for application objects.

---

# 6. Timestamp Strategy

All timestamp columns should use:

```sql
timestamptz
```

Recommended fields:

```text
created_at
updated_at
```

Where lifecycle matters, additionally use explicit timestamps such as:

```text
started_at
completed_at
archived_at
```

All timestamps are stored in UTC.

---

# 7. Identity Model

## 7.1 Supabase `auth.users`

Managed by Supabase. The application must not alter its authentication semantics.

Primary relationship:

```text
auth.users.id
     │
     ▼
profiles.id
```

## 7.2 `profiles`

### Purpose

Application-level user metadata.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK; references `auth.users.id` |
| display_name | text | YES | User-facing name |
| avatar_url | text | YES | Optional provider/avatar URL |
| created_at | timestamptz | NO | Default now() |
| updated_at | timestamptz | NO | Default now() |

### Constraints

```text
PK(id)
FK(id) → auth.users(id)
```

No role column is required in V1. There is no teacher/student role model.

---

# 8. Projects

## `projects`

### Purpose

Primary isolation boundary for user data and AI knowledge.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| owner_id | uuid | NO | FK → profiles.id |
| name | text | NO | User-facing project name |
| description | text | YES | Optional project description |
| created_at | timestamptz | NO | Default now() |
| updated_at | timestamptz | NO | Default now() |
| archived_at | timestamptz | YES | Soft archive marker |

### Invariants

- `owner_id` must always resolve to an authenticated profile.
- All child project-owned objects must use the same project.
- Archived projects remain queryable for historical integrity but should not appear in default active-project lists.

### Recommended indexes

```text
(owner_id)
(owner_id, archived_at)
```

---

# 9. Resources

## `resources`

### Purpose

Represents one uploaded study-material file.

Supported V1 resource formats:

- PDF
- DOCX
- PPT/PPTX

PYQs and syllabi are not separate database entities in V1. They are represented as resources with a `resource_kind`.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| project_id | uuid | NO | FK → projects.id |
| uploaded_by | uuid | NO | FK → profiles.id |
| original_filename | text | NO | Original user-visible filename |
| storage_path | text | NO | Supabase Storage object path |
| mime_type | text | NO | Validated against allowed types |
| file_extension | text | NO | Normalized extension |
| file_size_bytes | bigint | NO | Upload size |
| resource_kind | text | NO | Reference classification |
| status | text | NO | Lifecycle status |
| checksum_sha256 | text | YES | Optional duplicate/upload integrity hash |
| created_at | timestamptz | NO | Default now() |
| updated_at | timestamptz | NO | Default now() |
| archived_at | timestamptz | YES | Soft archive |

### Recommended `resource_kind` values

```text
STUDY_MATERIAL
PRESENTATION
PYQ
SYLLABUS
OTHER
```

The product must not require `PYQ` or `SYLLABUS` resources.

### Recommended `status` values

```text
UPLOADING
PROCESSING
READY
FAILED
ARCHIVED
```

### Constraints

- `project_id` must belong to `uploaded_by`.
- Storage path is generated server-side.
- Client-provided paths must not be trusted.
- Binary files are not stored in this table.

### Recommended indexes

```text
(project_id, status)
(project_id, archived_at)
(project_id, created_at DESC)
```

---

# 10. Resource Processing Runs

## `resource_processing_runs`

### Purpose

Preserves processing history and allows reprocessing without overwriting the audit trail.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| resource_id | uuid | NO | FK → resources.id |
| status | text | NO | Processing state |
| parser_version | text | YES | Parser implementation/version |
| chunking_version | text | YES | Chunking strategy/version |
| embedding_model | text | YES | Model identifier |
| started_at | timestamptz | YES | Start time |
| completed_at | timestamptz | YES | Completion time |
| error_message | text | YES | Failure reason |
| metadata | jsonb | YES | Non-critical run metadata |
| created_at | timestamptz | NO | Default now() |

### Status values

```text
PENDING
RUNNING
READY
FAILED
CANCELLED
```

A resource may have multiple processing runs, but only one should be considered the current successful processing state.

### Indexes

```text
(resource_id, created_at DESC)
(resource_id, status)
```

---

# 11. Resource Chunks

## `resource_chunks`

### Purpose

Stores normalized text chunks used for retrieval and provenance.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| resource_id | uuid | NO | FK → resources.id |
| processing_run_id | uuid | NO | FK → resource_processing_runs.id |
| project_id | uuid | NO | Denormalized for security/filtering |
| chunk_index | integer | NO | Order within source/processing run |
| text | text | NO | Extracted normalized content |
| page_number | integer | YES | PDF/page provenance |
| slide_number | integer | YES | PPT/PPTX provenance |
| section_title | text | YES | Extracted section title |
| token_count | integer | YES | Optional preprocessing metadata |
| embedding | vector(EMBEDDING_DIM) | NO | pgvector embedding |
| metadata | jsonb | YES | Additional provenance metadata |
| created_at | timestamptz | NO | Default now() |

> `EMBEDDING_DIM` is a migration-time constant determined by the selected V1 embedding model. The final production migration must replace the placeholder with the actual embedding dimension before creating the vector index.

### Important invariant

All chunks used for a comparable vector search must be embedded with the same embedding model/version.

Changing the embedding model requires re-embedding affected chunks.

### Recommended indexes

```text
(resource_id, processing_run_id, chunk_index)
(project_id)
```

A pgvector HNSW index should be added after the embedding model/dimension is fixed and retrieval behavior is benchmarked.

---

# 12. Topic Map

## `topics`

### Purpose

Stores the editable project-level topic hierarchy inferred from resources or manually defined/edited by the user.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| project_id | uuid | NO | FK → projects.id |
| parent_id | uuid | YES | Self-FK → topics.id |
| name | text | NO | Topic name |
| description | text | YES | Optional description |
| source | text | NO | Origin of topic |
| sort_order | integer | NO | UI/order position |
| is_active | boolean | NO | Default true |
| created_at | timestamptz | NO | Default now() |
| updated_at | timestamptz | NO | Default now() |
| archived_at | timestamptz | YES | Soft archive |

### `source` values

```text
INFERRED
USER_DEFINED
IMPORTED
```

### Constraints

- `parent_id` must reference a topic in the same project.
- Topic names should be unique among siblings within a project when active.
- Circular parent relationships are forbidden.

### Recommended unique/index strategy

```text
UNIQUE(project_id, parent_id, normalized_name)
INDEX(project_id, parent_id, sort_order)
```

`normalized_name` may be implemented as a generated column or normalized application field if needed.

---

# 13. Chunk ↔ Topic Mapping

## `chunk_topics`

### Purpose

Many-to-many mapping between retrieval chunks and project topics.

A chunk can contain multiple topics, and a topic can correspond to many chunks.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| chunk_id | uuid | NO | FK → resource_chunks.id |
| topic_id | uuid | NO | FK → topics.id |
| confidence | numeric(5,4) | YES | Optional classifier confidence |
| source | text | NO | Mapping origin |
| created_at | timestamptz | NO | Default now() |

### Primary key

```text
PK(chunk_id, topic_id)
```

### `source` values

```text
AUTO_INFERRED
USER_ASSIGNED
```

Project integrity must prevent mapping a chunk to a topic from another project.

---

# 14. Reference Tables

The following are database-backed reference/configuration tables rather than PostgreSQL enums.

## 14.1 `bloom_levels`

| Column | Type |
|---|---|
| id | uuid | 
| slug | text |
| name | text |
| description | text |
| display_order | integer |
| is_active | boolean |

Seed values:

```text
remember
understand
apply
analyze
evaluate
create
```

## 14.2 `difficulty_levels`

Seed values:

```text
EASY
MEDIUM
HARD
```

Columns:

```text
id
slug
name
description
display_order
is_active
```

## 14.3 `question_types`

V1 seed values:

```text
MCQ
SHORT_ANSWER
LONG_ANSWER
```

Columns are the same reference-table pattern.

## 14.4 `question_styles`

Recommended V1 seed values:

```text
CONCEPTUAL
COMPARATIVE
APPLICATION
SCENARIO
CASE_BASED
ANALYTICAL
CAUSE_EFFECT
EVALUATIVE
DESIGN_SYNTHESIS
```

The list may be refined during implementation, but the data model must allow additions without schema changes.

---

# 15. Generation Presets

## `generation_presets`

### Purpose

Reusable user-facing configurations such as:

- Exam Preparation
- Deep Understanding
- High-Order Thinking
- Revision
- Custom

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| owner_id | uuid | YES | FK → profiles.id; null for system preset |
| project_id | uuid | YES | Optional project scope |
| name | text | NO | Preset name |
| description | text | YES | User-facing explanation |
| configuration | jsonb | NO | Strictly validated blueprint-like structure |
| is_system | boolean | NO | Default false |
| created_at | timestamptz | NO | Default now() |
| updated_at | timestamptz | NO | Default now() |
| archived_at | timestamptz | YES | Soft archive |

### Ownership rules

- System presets: `is_system = true`, `owner_id IS NULL`.
- User presets: `is_system = false`, `owner_id IS NOT NULL`.
- Project-specific presets may additionally set `project_id`.

---

# 16. Generation Blueprints

## `generation_blueprints`

### Purpose

Stores reusable question-generation configurations.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| project_id | uuid | NO | FK → projects.id |
| created_by | uuid | NO | FK → profiles.id |
| name | text | YES | Optional label |
| configuration | jsonb | NO | Normalized blueprint configuration |
| created_at | timestamptz | NO | Default now() |
| updated_at | timestamptz | NO | Default now() |
| archived_at | timestamptz | YES | Soft archive |

### Required configuration concepts

```json
{
  "question_count": 20,
  "topics": {
    "topic_uuid_1": 40,
    "topic_uuid_2": 60
  },
  "bloom": {
    "apply": 40,
    "analyze": 40,
    "evaluate": 20
  },
  "difficulty": {
    "medium": 30,
    "hard": 70
  },
  "question_types": {
    "mcq": 60,
    "short_answer": 40
  },
  "styles": {
    "scenario": 50,
    "analytical": 30,
    "comparative": 20
  },
  "duplicate_policy": "PREVENT"
}
```

The exact JSON shape must be validated by application-level schemas. Database JSONB must not become an unvalidated dumping ground.

### Distribution invariant

Each weighted dimension must either:

- sum to exactly 100, or
- use a documented implementation-specific allocation method.

V1 should prefer explicit 100%-sum distributions.

---

# 17. Generation Runs

## `generation_runs`

### Purpose

Persistent job representing one user generation request.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| project_id | uuid | NO | FK → projects.id |
| blueprint_id | uuid | YES | FK → generation_blueprints.id |
| blueprint_snapshot | jsonb | NO | Immutable run-time configuration |
| status | text | NO | Generation lifecycle |
| requested_count | integer | NO | User requested count |
| accepted_count | integer | NO | Current accepted count |
| review_count | integer | NO | Items requiring review |
| duplicate_policy | text | NO | Snapshot of duplicate setting |
| model_provider | text | NO | `ollama` for V1 |
| model_name | text | NO | Actual selected model |
| model_version | text | YES | Runtime/model version if available |
| embedding_model | text | YES | Embedding model used for retrieval |
| created_by | uuid | NO | FK → profiles.id |
| created_at | timestamptz | NO | Default now() |
| started_at | timestamptz | YES | Processing start |
| completed_at | timestamptz | YES | Processing completion |
| error_message | text | YES | Terminal error if applicable |
| metadata | jsonb | YES | Non-critical run metadata |

### Status values

```text
CREATED
QUEUED
PLANNING
RETRIEVING
GENERATING
VALIDATING
REGENERATING
COMPLETED
FAILED
NEEDS_REVIEW
```

### Important invariant

The `blueprint_snapshot` is immutable after generation begins.

Changing the underlying blueprint must never rewrite historical generation behavior.

---

# 18. Generation Plan Items

## `generation_plan_items`

### Purpose

Represents the concrete target for an individual requested question before candidate generation.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| generation_run_id | uuid | NO | FK → generation_runs.id |
| sequence_number | integer | NO | Question target order |
| topic_id | uuid | YES | Target topic |
| question_type_id | uuid | NO | Target format |
| bloom_level_id | uuid | NO | Target Bloom level |
| difficulty_level_id | uuid | NO | Target difficulty |
| style_id | uuid | NO | Target question style |
| status | text | NO | Plan-item lifecycle |
| created_at | timestamptz | NO | Default now() |
| updated_at | timestamptz | NO | Default now() |

### Status values

```text
PLANNED
GENERATING
VALIDATING
ACCEPTED
REGENERATING
NEEDS_REVIEW
FAILED
```

### Constraint

`sequence_number` must be unique within a generation run.

---

# 19. Generation Attempts

## `generation_attempts`

### Purpose

Records each candidate-generation attempt for a plan item.

Example:

```text
Attempt 1 → Bloom FAIL
Attempt 2 → Duplicate FAIL
Attempt 3 → PASS
```

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| generation_run_id | uuid | NO | FK → generation_runs.id |
| plan_item_id | uuid | NO | FK → generation_plan_items.id |
| attempt_number | integer | NO | 1-based |
| status | text | NO | Attempt result |
| model_name | text | NO | Model actually used |
| prompt_version | text | YES | Prompt/template version identifier |
| raw_output | text | YES | Raw LLM output, subject to retention policy |
| parsed_output | jsonb | YES | Structured parsed candidate |
| failure_reason | text | YES | Parsing/system failure |
| created_at | timestamptz | NO | Default now() |
| completed_at | timestamptz | YES | Completion |

### Status values

```text
GENERATED
PARSE_FAILED
VALIDATION_FAILED
ACCEPTED
FAILED
```

Raw model output should be retained only as needed for debugging/reproducibility. The application must not expose internal raw prompts or chain-of-thought to users.

---

# 20. Questions

## `questions`

### Purpose

Logical identity of a question independent of mutable content versions.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| project_id | uuid | NO | FK → projects.id |
| generation_run_id | uuid | YES | FK → generation_runs.id |
| generation_plan_item_id | uuid | YES | FK → generation_plan_items.id |
| current_version_id | uuid | YES | FK → question_versions.id; added after table creation if needed |
| status | text | NO | Long-term question status |
| created_at | timestamptz | NO | Default now() |
| updated_at | timestamptz | NO | Default now() |
| archived_at | timestamptz | YES | Soft archive |

### Long-term `status` values

```text
AVAILABLE
NEEDS_REVIEW
REJECTED
ARCHIVED
```

Transient AI lifecycle states belong to generation runs/attempts, not to this field.

---

# 21. Question Versions

## `question_versions`

### Purpose

Stores the actual question content and version-specific metadata.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| question_id | uuid | NO | FK → questions.id |
| version_number | integer | NO | Incrementing per question |
| question_text | text | NO | Primary user-facing content |
| question_type_id | uuid | NO | FK → question_types.id |
| bloom_level_id | uuid | NO | FK → bloom_levels.id |
| difficulty_level_id | uuid | NO | FK → difficulty_levels.id |
| style_id | uuid | NO | FK → question_styles.id |
| topic_id | uuid | YES | FK → topics.id |
| origin | text | NO | Creation origin |
| created_by | uuid | YES | User for manual edits; null for system-generated |
| source_attempt_id | uuid | YES | FK → generation_attempts.id |
| created_at | timestamptz | NO | Default now() |

### `origin` values

```text
AI_GENERATED
AI_REGENERATED
USER_EDITED
MANUAL
```

### Constraints

```text
UNIQUE(question_id, version_number)
```

### Versioning rule

Never update an existing `question_versions` row to represent a substantive user edit.

Create a new version.

---

# 22. Question Options

## `question_options`

### Purpose

Stores MCQ options without hardcoding a fixed number of columns.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| question_version_id | uuid | NO | FK → question_versions.id |
| option_index | integer | NO | Stable display ordering |
| option_text | text | NO | Option content |
| is_correct | boolean | NO | Exactly one true for valid V1 MCQ |
| created_at | timestamptz | NO | Default now() |

### Constraints

```text
UNIQUE(question_version_id, option_index)
```

Application validation must enforce:

```text
MCQ → valid option count + exactly one correct option
```

---

# 23. Question Source References

## `question_source_refs`

### Purpose

Links a specific question version to the exact source chunks that grounded its generation.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| question_version_id | uuid | NO | FK → question_versions.id |
| chunk_id | uuid | NO | FK → resource_chunks.id |
| relevance_score | numeric(7,6) | YES | Retrieval/relevance score |
| evidence_text | text | YES | Concise extracted evidence shown to user |
| display_order | integer | NO | Evidence ordering |
| created_at | timestamptz | NO | Default now() |

### Critical invariant

All referenced chunks must belong to the same project as the question's project.

### Why version-specific?

Manual edits can change the question's conceptual basis. Provenance therefore belongs to the exact version that was generated/validated.

---

# 24. Validation Runs

## `validation_runs`

### Purpose

Represents a complete validation pass on one question version.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| question_version_id | uuid | NO | FK → question_versions.id |
| generation_attempt_id | uuid | YES | FK → generation_attempts.id |
| status | text | NO | Validation lifecycle |
| validator_version | text | YES | Version of validation pipeline |
| overall_result | text | NO | PASS/FAIL/REVIEW |
| started_at | timestamptz | NO | Start |
| completed_at | timestamptz | YES | Completion |
| created_at | timestamptz | NO | Default now() |

### `status` values

```text
RUNNING
COMPLETED
FAILED
```

### `overall_result` values

```text
PASS
FAIL
REVIEW
```

---

# 25. Validation Checks

## `validation_checks`

### Purpose

One row per validation dimension within a validation run.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| validation_run_id | uuid | NO | FK → validation_runs.id |
| check_type | text | NO | Validation dimension |
| result | text | NO | PASS/FAIL/WARNING/NOT_APPLICABLE |
| score | numeric(7,6) | YES | Optional numeric score |
| reason | text | YES | Concise user-facing reason |
| evidence | jsonb | YES | Structured validation evidence |
| created_at | timestamptz | NO | Default now() |

### V1 check types

```text
GROUNDING
TOPIC_ALIGNMENT
BLOOM_ALIGNMENT
DIFFICULTY_ALIGNMENT
STYLE_ALIGNMENT
STRUCTURAL
MCQ_VALIDITY
DUPLICATE
QUALITY
```

### V1 result values

```text
PASS
FAIL
WARNING
NOT_APPLICABLE
```

### Important privacy/UX rule

`reason` and `evidence` must contain structured validation evidence, not hidden model chain-of-thought.

Example:

```json
{
  "requested": "Analyze",
  "predicted": "Understand",
  "mismatch": true
}
```

---

# 26. Duplicate Matches

## `duplicate_matches`

### Purpose

Persists similarity-based duplicate evaluation between a candidate/current question version and an existing project question version.

### Proposed columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| id | uuid | NO | PK |
| question_version_id | uuid | NO | Candidate/current version |
| matched_question_version_id | uuid | NO | Existing project version |
| similarity_score | numeric(7,6) | NO | Semantic similarity |
| decision | text | NO | Outcome |
| created_at | timestamptz | NO | Default now() |

### Decision values

```text
DUPLICATE
NOT_DUPLICATE
REVIEW
```

### Constraints

- Candidate and matched question versions must belong to the same project.
- A question version must not match itself.

---

# 27. Duplicate Policy

The generation blueprint must record:

```text
duplicate_policy = PREVENT | ALLOW
```

The policy is copied into `generation_runs.blueprint_snapshot` and `duplicate_policy` so historical runs preserve the exact behavior used.

When `PREVENT` is selected:

1. Candidate is compared against accepted/current project questions.
2. Semantic similarity is evaluated.
3. Duplicate decisions are persisted.
4. A rejected duplicate returns to regeneration.

When `ALLOW` is selected:

- exact/semantic duplicate checks may be skipped for rejection purposes,
- but the system may still record similarity metadata for diagnostics if implementation chooses to do so.

---

# 28. Archive-First Lifecycle

Normal application deletion is **soft archive**, not physical deletion.

## Resources

```text
READY
  ↓
ARCHIVED
```

## Projects

```text
ACTIVE
  ↓
ARCHIVED
```

## Topics

```text
ACTIVE
  ↓
ARCHIVED
```

## Questions

```text
AVAILABLE / NEEDS_REVIEW / REJECTED
  ↓
ARCHIVED
```

### Why

Historical questions may refer to:

- old resources,
- old chunks,
- old validation results,
- old generation runs.

Hard deletion risks destroying provenance and reproducibility.

---

# 29. Deletion and Foreign-Key Policy

Because archiving is the normal user action, destructive cascades should be used sparingly.

Recommended relationship semantics:

### User → Project

Do not rely on cascading deletion of application data from `auth.users` as the normal lifecycle.

### Project → Resources/Topics/Questions/Generation Data

Normal application lifecycle is archive, not delete.

### Resource → Chunks / Processing Runs

Physical deletion should be an administrative migration/cleanup concern, not ordinary UI behavior.

### Question → Question Versions

Question versions should never disappear through routine application deletion.

### Version → Validation / Source References / Options

These are tightly coupled artifacts. If a version is physically removed in a controlled cleanup operation, dependent artifacts may cascade.

### Generation Run → Attempts / Plan Items

Attempts and plan items should remain as historical run evidence.

---

# 30. Cross-Project Integrity

A central security/data-integrity requirement is preventing cross-project references.

Examples of invalid states:

```text
Question in Project A
→ Source chunk in Project B
```

```text
Generation run in Project A
→ Topic in Project B
```

```text
Chunk in Project A
→ Topic in Project B
```

The application must reject all such states.

Where practical, PostgreSQL composite foreign-key patterns or trigger-based validation should enforce these invariants at the database level rather than relying only on application code.

---

# 31. Row Level Security (RLS)

RLS is required because the database is hosted in Supabase Cloud.

The database must enforce project ownership rather than trusting the frontend.

## Ownership chain

```text
auth.uid()
   ↓
projects.owner_id
   ↓
project-owned entities
```

Recommended pattern:

- `projects`: direct owner policy.
- child tables: access through project ownership checks.
- `profiles`: user can read/update only their own row.
- reference tables: read access for authenticated users, admin mutation only if needed.

For complex child policies, use a carefully designed `SECURITY DEFINER` helper such as:

```text
user_owns_project(project_uuid)
```

to avoid repetitive policy logic and potential RLS recursion.

Never expose Supabase service-role credentials to the browser.

---

# 32. RLS Conceptual Policies

## `profiles`

```text
SELECT/UPDATE where id = auth.uid()
```

## `projects`

```text
SELECT/INSERT/UPDATE/ARCHIVE where owner_id = auth.uid()
```

## Project-owned child tables

```text
allow when referenced project belongs to auth.uid()
```

## Reference tables

Read-only for normal authenticated users.

## Generation/AI records

Accessible only when the associated project belongs to `auth.uid()`.

---

# 33. Generated Question Data Model

The complete relationship should conceptually be:

```text
Project
  │
  ├── Generation Blueprint
  │         │
  │         ▼
  │    Generation Run
  │         │
  │         ├── Plan Item
  │         │      │
  │         │      └── Attempts
  │         │
  │         └── Questions
  │                │
  │                └── Question Versions
  │                       ├── Options
  │                       ├── Source References
  │                       └── Validation Runs
  │                              └── Validation Checks
  │
  ├── Resources
  │      └── Chunks
  │             └── Chunk Topics
  │
  └── Topic Map
```

---

# 34. Question Version Lifecycle

Example:

```text
Question Q42
│
├── Version 1
│   ├── origin = AI_GENERATED
│   ├── source evidence
│   └── validation results
│
├── Version 2
│   ├── origin = AI_REGENERATED
│   ├── new source evidence
│   └── new validation results
│
└── Version 3
    ├── origin = USER_EDITED
    ├── validation = OUTDATED
    └── may be revalidated
```

`questions.current_version_id` points to the currently active version.

On manual editing:

1. Create new version.
2. Copy/derive editable metadata.
3. Mark prior validation state as stale through application state or a derived current-version lookup.
4. Re-run validation when required.
5. Update `current_version_id` only after version creation succeeds.

---

# 35. Validation Staleness

Validation belongs to a version, not to the logical question.

Therefore:

```text
Question Version 1
→ Validation PASS
```

followed by:

```text
Question Version 2
→ created by manual edit
```

must not display Version 1's validation as though it applies to Version 2.

The application must retrieve validation only for the active version or explicitly selected historical version.

---

# 36. Source Provenance Model

For every accepted AI-generated question version, the system should be able to traverse:

```text
Question Version
     ↓
Question Source Ref
     ↓
Resource Chunk
     ↓
Processing Run
     ↓
Resource
     ↓
Supabase Storage File
```

This satisfies:

- grounding verification,
- evidence display,
- debugging retrieval,
- reproducibility.

---

# 37. RAG Retrieval Data Contract

A retrieval operation should be able to filter by:

```text
project_id
resource_id (optional)
topic_id (optional)
```

and return:

```text
chunk_id
text
similarity_score
resource_id
page/slide provenance
section
```

The query must never return chunks from another project.

---

# 38. Vector Data Requirements

`resource_chunks.embedding` stores local embedding vectors.

The selected embedding model must be recorded at the processing-run level and generation-run level.

Changing the embedding model requires re-embedding affected chunks before they are considered comparable.

### Recommended index

After benchmarking, use an HNSW vector index appropriate for the chosen pgvector operator class and vector dimension.

Do not hardcode an embedding dimension before the V1 embedding model is selected.

---

# 39. JSONB Usage Rules

JSONB is deliberately limited to configuration/evidence metadata.

### Appropriate JSONB uses

```text
blueprint.configuration

generation_runs.blueprint_snapshot

generation_runs.metadata

validation_checks.evidence

resource_processing_runs.metadata

resource_chunks.metadata
```

### Inappropriate JSONB uses

Do not store core relational entities as giant JSON documents.

For example, do not store all questions inside one project JSON document.

Core searchable/queryable entities remain relational tables.

---

# 40. Index Strategy

The initial index set should prioritize common access paths.

## Projects

```text
INDEX projects(owner_id)
INDEX projects(owner_id, archived_at)
```

## Resources

```text
INDEX resources(project_id, status)
INDEX resources(project_id, created_at DESC)
```

## Chunks

```text
INDEX resource_chunks(project_id)
INDEX resource_chunks(resource_id, processing_run_id, chunk_index)
```

## Topics

```text
INDEX topics(project_id, parent_id, sort_order)
```

## Generation

```text
INDEX generation_runs(project_id, created_at DESC)
INDEX generation_plan_items(generation_run_id, sequence_number)
INDEX generation_attempts(plan_item_id, attempt_number)
```

## Questions

```text
INDEX questions(project_id, status)
INDEX questions(project_id, created_at DESC)
INDEX question_versions(question_id, version_number)
INDEX question_versions(project_id) -- only if project_id is denormalized/needed in implementation
```

## Validation

```text
INDEX validation_runs(question_version_id, created_at DESC)
INDEX validation_checks(validation_run_id, check_type)
```

## Provenance

```text
INDEX question_source_refs(question_version_id)
INDEX question_source_refs(chunk_id)
```

## Duplicate detection

```text
INDEX duplicate_matches(question_version_id)
INDEX duplicate_matches(matched_question_version_id)
```

Add additional indexes only after observing actual query patterns.

---

# 41. Unique Constraints

Recommended uniqueness rules include:

```text
profiles.id
projects-specific topic sibling names
resource processing run identifiers naturally by UUID
chunk ordering within processing run
blueprint/preset identifiers by UUID
plan item sequence within generation run
question version number within question
question option index within question version
chunk/topic pair in chunk_topics
```

Specific SQL uniqueness expressions may be refined during migration implementation.

---

# 42. Resource Processing and Reprocessing

When a resource is reprocessed:

```text
Resource
  ↓
New processing_run
  ↓
New chunks
  ↓
New embeddings
```

Do not overwrite the historical processing run.

The application should designate one processing run as the current successful one through resource state/metadata rather than deleting earlier runs.

---

# 43. Topic Editing Rules

When the user edits the topic map:

- topic ID should remain stable for rename operations,
- deleting/archiving a topic should not physically delete historical questions,
- generation blueprints referencing an archived topic must be flagged as stale/invalid before future generation,
- chunk-topic mappings to archived topics may remain for historical provenance.

A topic rename must not rewrite historical question versions.

---

# 44. Question Archiving Rules

Archiving a question should:

- set `questions.archived_at`,
- set status to `ARCHIVED`,
- keep all versions,
- keep validation history,
- keep source references,
- keep generation provenance.

Archived questions should normally be excluded from active duplicate comparison unless an explicit historical comparison mode is used.

---

# 45. Generation Count Integrity

The system must distinguish:

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

The application must never falsify `accepted_count` to equal the requested count.

---

# 46. Failure Handling Data

Failures should retain enough metadata for diagnosis.

Examples:

```text
resource_processing_runs.error_message

generation_runs.error_message

generation_attempts.failure_reason

validation_checks.reason
```

Avoid storing secrets, auth tokens, unnecessary personal information, or hidden chain-of-thought.

---

# 47. Data Retention Guidelines

V1 should retain:

- projects
- resources
- processing history
- chunks
- embeddings
- topic map
- generation blueprints
- generation runs
- plan items
- generation attempts
- questions
- question versions
- validation runs/checks
- provenance

V1 may later implement administrative cleanup for obsolete embeddings or archived resources, but normal product behavior must not physically delete historical data.

---

# 48. Migration Strategy

Database changes must use versioned Supabase migrations.

Recommended order:

```text
1. Enable required PostgreSQL extensions
2. Create profiles
3. Create projects
4. Create resources
5. Create resource_processing_runs
6. Create resource_chunks
7. Create topics
8. Create chunk_topics
9. Create reference tables
10. Seed reference data
11. Create generation_presets
12. Create generation_blueprints
13. Create generation_runs
14. Create generation_plan_items
15. Create generation_attempts
16. Create questions
17. Create question_versions
18. Create question_options
19. Create question_source_refs
20. Create validation_runs
21. Create validation_checks
22. Create duplicate_matches
23. Add cross-project integrity constraints/triggers
24. Add RLS policies
25. Add standard indexes
26. Add pgvector index after embedding model dimension is finalized
```

Migration files should be ordered and committed to Git.

Never edit an already-applied migration to change production-like state; create a new migration.

---

# 49. Seed Data

V1 seed data should include:

### Bloom levels

```text
Remember
Understand
Apply
Analyze
Evaluate
Create
```

### Difficulty

```text
Easy
Medium
Hard
```

### Question types

```text
MCQ
Short Answer
Long Answer
```

### Question styles

```text
Conceptual
Comparative
Application
Scenario
Case-based
Analytical
Cause-effect
Evaluative
Design/Synthesis
```

The application must not rely on frontend hardcoding of reference-table IDs.

Use stable slugs.

---

# 50. Database Access Pattern

The backend should access data through repository/data-access modules rather than embedding raw SQL throughout controllers.

Recommended conceptual pattern:

```text
Controller
   ↓
Service
   ↓
Repository / Data Access
   ↓
PostgreSQL / Supabase
```

AI services should not directly manipulate the database outside controlled repository/service boundaries.

---

# 51. Transaction Boundaries

Use transactions around operations that must be atomic.

Examples:

### Create question version

```text
BEGIN
  insert question_version
  insert options if MCQ
  insert source references
  update questions.current_version_id
COMMIT
```

### Complete validation

```text
BEGIN
  insert validation_run
  insert validation_checks
  update generation attempt / question status
COMMIT
```

### Accept generation candidate

A candidate should not become an accepted question unless its required relational artifacts can be persisted coherently.

---

# 52. Concurrency Assumptions

V1 is primarily a single local user application.

No distributed concurrency architecture is required.

Nevertheless, database updates should still be designed safely enough that accidental duplicate commits or UI retries do not create multiple active current versions for a single question.

Future concurrent-user infrastructure is a V2 concern.

---

# 53. Privacy and Security Requirements

The database layer must support:

- project-level isolation,
- user-level authentication,
- RLS,
- secure Supabase Storage policies,
- no service-role key in frontend,
- no sensitive token persistence in application tables.

Uploaded resources should be treated as user data and must not be exposed across projects.

---

# 54. Recommended Supabase Storage Layout

Recommended object-path pattern:

```text
resources/{project_id}/{resource_id}/{safe_filename}
```

The server creates the final object path.

Never use a raw client-provided filename as the complete storage key.

The database's `storage_path` is the canonical pointer to the stored file.

---

# 55. Data Flow Summary

## Resource ingestion

```text
Supabase Storage file
        ↓
resources
        ↓
resource_processing_runs
        ↓
resource_chunks
        ↓
pgvector embedding
        ↓
chunk_topics
```

## Question generation

```text
generation_blueprint
        ↓
generation_run
        ↓
generation_plan_items
        ↓
generation_attempts
        ↓
question
        ↓
question_version
        ├── question_options
        └── question_source_refs
```

## Validation

```text
question_version
        ↓
validation_run
        ↓
validation_checks
        ↓
PASS / FAIL / REVIEW
```

## Duplicate detection

```text
candidate question_version
        ↓
project questions
        ↓
duplicate_matches
        ↓
DUPLICATE / NOT_DUPLICATE / REVIEW
```

---

# 56. Entity Relationship Overview

```text
                           auth.users
                               │
                               ▼
                           profiles
                               │
                         owner_id / created_by
                               │
                               ▼
                           projects
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
          resources          topics        blueprints
              │                │                │
              ▼                ▲                ▼
   processing_runs             │        generation_runs
              │                │                │
              ▼                │        ┌───────┴────────┐
        resource_chunks ── chunk_topics  │                │
              │                         ▼                ▼
              │                 plan_items          attempts
              │                                         │
              │                                         ▼
              └───────────────► source_refs ◄──── question_versions
                                           │             │
                                           │             ├── options
                                           │             └── validation_runs
                                           │                    │
                                           │                    ▼
                                           │              validation_checks
                                           │
                                           └──────────── duplicate_matches
```

---

# 57. Definition of Done for Database V1

The database design is considered implemented when:

1. Supabase Auth users can map to application profiles.
2. Users can own multiple projects.
3. Projects isolate all project-scoped data.
4. Resources can store supported PDF/DOCX/PPT/PPTX metadata and point to Supabase Storage.
5. Resource processing has auditable runs.
6. Chunks retain exact source provenance.
7. Chunk embeddings are stored in pgvector.
8. Topics form an editable project-level hierarchy.
9. Chunks can map to multiple topics.
10. Bloom, difficulty, type and style are database-backed reference tables.
11. Generation presets and blueprints are persisted.
12. Generation runs preserve immutable configuration snapshots.
13. Plan items represent concrete target questions.
14. Generation attempts retain retry/failure metadata.
15. Questions have versioned content.
16. MCQ options are normalized separately.
17. Question versions retain exact source references.
18. Validation runs/checks are version-specific.
19. Duplicate matches are project-scoped.
20. Archive-first lifecycle is enforced at the application level.
21. RLS prevents cross-user project access.
22. Cross-project references are rejected.
23. Historical generation and validation evidence remains available after edits.
24. Database migrations can recreate the schema from scratch.

---

# 58. AI Coding Agent Rules

AI coding agents working on this repository must follow these rules.

### Rule 1 — Do not create duplicate sources of truth

Do not create a second database for question metadata, topics or generation state.

### Rule 2 — Do not move files into Postgres

Original files stay in Supabase Storage.

### Rule 3 — Do not bypass project ownership

Every project-scoped query must enforce ownership.

### Rule 4 — Do not store question edits by overwriting versions

Create a new `question_versions` row.

### Rule 5 — Do not treat validation as question-level history only

Validation always belongs to a specific question version.

### Rule 6 — Do not use global duplicate detection

Duplicate comparison is project-scoped.

### Rule 7 — Do not silently weaken generation constraints

Database state must reflect the actual accepted/review counts.

### Rule 8 — Do not hard-delete through normal user actions

Archive resources, projects, topics and questions.

### Rule 9 — Do not hardcode reference IDs in frontend code

Use stable slugs and database records.

### Rule 10 — Do not put core relational data into arbitrary JSONB blobs

JSONB is for configuration snapshots and flexible evidence metadata.

### Rule 11 — Do not expose privileged Supabase credentials to the browser

Service-role credentials belong only on the backend.

### Rule 12 — Preserve provenance

An AI-generated question must remain traceable to project resource chunks.

---

# 59. Future-Proofing Boundaries

The V1 schema intentionally supports later changes without requiring a full redesign.

Potential V2 additions may include:

- cloud LLM provider metadata,
- numerical question/solver artifacts,
- richer exam-paper entities,
- external deployment metadata,
- human evaluation records,
- research experiments,
- collaborative features.

These are not V1 schema requirements.

The database must not be polluted with speculative tables merely because a future feature is possible.

---

# 60. Final Database Design Statement

V1 uses **PostgreSQL as the source of truth, Supabase Auth for identity, Supabase Storage for original resources, pgvector for project-scoped semantic retrieval, and normalized relational entities for projects, resources, topics, generation configuration, generation execution, questions, version history and validation evidence**.

The core persistence chain is:

```text
Authenticated User
      ↓
Project
      ↓
Resources ──→ Processing Runs ──→ Chunks ──→ Embeddings
      │
      └────────────→ Topic Map
      │
      └────────────→ Generation Blueprint
                            ↓
                     Generation Run
                            ↓
                     Plan Items
                            ↓
                      Attempts
                            ↓
                        Question
                            ↓
                    Question Version
                    ├── Options
                    ├── Source References
                    └── Validation Runs
                            ↓
                    Validation Checks
                            ↓
                  Duplicate / Review State
```

This schema is intentionally normalized around the project's real lifecycle: **resource ingestion → topic mapping → blueprint configuration → planned generation → candidate attempts → versioned questions → source provenance → independent validation → duplicate/diversity decisions**.

It is the persistence contract for V1 and should be implemented through versioned Supabase migrations rather than ad-hoc database changes.
