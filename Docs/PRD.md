# Product Requirements Document (PRD)

## Syllabus-Grounded Controllable Question Generation Platform

**Document Type:** Product Requirements Document / Project README  
**Version:** 1.0  
**Scope:** V1  
**Status:** Feature scope frozen for development planning  
**Primary AI Approach:** Retrieval-Augmented Generation (RAG) + lightweight local LLM  
**Deployment Philosophy:** Free/local-first; no paid API required for V1

---

## 1. Product Overview

This project is a role-neutral, authenticated question-generation platform that creates high-quality educational questions from study resources supplied by the user.

The platform is intentionally scoped as a **question generator**, not as a grading system, adaptive learning platform, tutoring chatbot, or student-performance analytics system.

The central product objective is:

> Generate diverse, high-order, configurable questions from user-provided study material using a lightweight local LLM, while validating that the generated questions satisfy the user's requested cognitive, difficulty, stylistic, grounding, and diversity constraints.

The system must remain practical on ordinary consumer hardware without requiring a dedicated GPU or paid LLM API.

---

## 2. Product Vision

Existing question-generation systems can produce large quantities of questions, but quantity alone does not solve the core educational problem. A useful system must provide control over **what kind of question is generated**, **how cognitively demanding it is**, **what topic it tests**, and **whether generated questions are sufficiently distinct and grounded in the user's material**.

This project therefore treats question generation as a constrained pipeline rather than a single LLM prompt.

The intended pipeline is:

```text
User Resources
      ↓
Document Processing
      ↓
Topic / Knowledge Structure Extraction
      ↓
Generation Blueprint
      ↓
Topic-Aware Retrieval (RAG)
      ↓
Question Planning
      ↓
Lightweight Local LLM
      ↓
Candidate Questions
      ↓
Validation
      ↓
Duplicate / Diversity Checks
      ↓
Regeneration or Manual Review
      ↓
Question Bank
```

---

# 3. Target Users

## 3.1 Primary User

The product does **not** distinguish between teacher and student roles in V1.

Any authenticated user may:

- create projects,
- upload study material,
- configure question-generation requirements,
- generate questions,
- inspect validation results,
- manage the project question bank,
- regenerate or review failed questions.

A teacher may use it for assessment preparation.

A student may use it for exam preparation or self-practice.

The software does not assume either use case as the only intended workflow.

---

# 4. Product Scope

## 4.1 In Scope

### Project Management
- User authentication
- Project creation
- Multiple projects per user
- Project-specific resources
- Project-specific topic map
- Project-specific question bank
- Project-specific generation history

### Resource Management
- PDF upload
- DOCX upload
- PPT/PPTX upload
- Multiple resources within one project
- Text extraction
- Chunking
- Metadata preservation
- Local embeddings
- Project-specific vector knowledge base

### Topic / Knowledge Structure
- Automatic extraction of topic hierarchy from supplied resources
- User editing of the extracted topic map
- Add topic
- Remove topic
- Rename topic
- Merge/reorganize topics
- Use topic map for generation constraints and retrieval

### Controlled Question Generation
- User-selected number of questions
- Question-format selection
- Bloom's Taxonomy selection
- Difficulty selection
- Question-style selection
- Topic selection
- Distribution/weight configuration
- Generation presets
- RAG-grounded context retrieval
- Structured LLM output

### Question Validation
- Source grounding validation
- Topic alignment validation
- Bloom-level alignment validation
- Difficulty alignment validation
- Question-style alignment validation
- Structural validation
- MCQ-specific validation
- Semantic duplicate detection
- Batch diversity checks
- Constraint satisfaction checks

### Quality-Control Loop
- Automatic regeneration of failed questions
- Maximum retry limit
- Preservation of user constraints
- Manual-review state when constraints cannot be satisfied
- Visible validation status and validation explanation

### Question Bank
- Persist generated questions
- Search/filter questions
- View question metadata
- View source evidence
- Approve/reject questions
- Regenerate individual questions
- Delete questions
- Edit question metadata/content where supported
- Track question generation history

### Optional PYQ Support
- PYQs may be uploaded as additional resources
- PYQs are not mandatory
- When present, they may be analyzed for assessment patterns
- Pattern-based generation may be used as an optional generation mode

### Research-Relevant Metrics Internally
The application architecture should preserve enough metadata to support later external research/ablation work, including:

- grounding result,
- validation result,
- Bloom alignment,
- difficulty alignment,
- duplicate result,
- diversity measurements,
- retry count,
- generation latency,
- model configuration.

These capabilities are for development/research support and are **not exposed as a V1 research dashboard**.

---

# 5. Core Product Principles

## 5.1 Resource-Grounded Generation

The user's uploaded resources are the **primary basis for question construction**.

The system must not use web search or external web content during question generation.

The system may use information already encoded in the local language model for reasoning, but generated questions must be grounded in concepts, relationships, terminology, mechanisms, examples, scenarios, or other relevant material found in the supplied resources.

## 5.2 Question Grounding Does Not Require Answer Extraction

A generated question does **not** have to have a word-for-word answer present in the source material.

Higher-order questions may require:

- reasoning,
- application,
- comparison,
- analysis,
- evaluation,
- synthesis,
- scenario interpretation,
- domain aptitude.

Therefore, validation must determine whether the **question is grounded in the supplied material**, rather than requiring the answer to be explicitly retrievable from the source.

Example:

```text
Source material:
A semaphore is used for synchronization between processes.

Valid generated question:
Two processes access the same shared resource concurrently.
Using the synchronization concepts discussed in the material,
propose an approach that prevents inconsistent access and explain
why it is appropriate.
```

The answer may require reasoning beyond a sentence directly copied from the source.

## 5.3 High-Order Questions Are a Core Requirement

The product must prioritize questions that go beyond:

- simple WH questions,
- direct definition extraction,
- one-word factual recall,
- superficial paraphrasing,
- obvious textbook sentence conversion.

All six Bloom levels are supported, including the higher-order levels:

- Apply
- Analyze
- Evaluate
- Create

## 5.4 Constraints Must Be Explicit

The user should be able to define what kind of questions are desired instead of relying on vague instructions such as “make it harder.”

## 5.5 Validation Is Part of Generation

Question generation is not considered complete when the LLM produces text.

A question becomes acceptable only after it passes the configured validation criteria or is explicitly sent to manual review.

## 5.6 Never Silently Relax User Constraints

If the system cannot generate the requested number of valid questions within the configured retry policy, it must not quietly lower difficulty, alter Bloom levels, accept duplicates, or otherwise weaken constraints just to satisfy the requested count.

The failed items must instead be identified for manual review.

---

# 6. Question Configuration Model

Question characteristics are deliberately represented as **separate dimensions** rather than collapsing everything into a single Easy/Medium/Hard field.

## 6.1 Question Format

V1 formats:

- MCQ
- Short Answer
- Long Answer

Numerical/problem-solving question generation is deferred beyond V1.

## 6.2 Bloom Cognitive Level

All six Bloom levels are supported:

1. Remember
2. Understand
3. Apply
4. Analyze
5. Evaluate
6. Create

The user may select one or more levels and may assign distribution weights.

## 6.3 Difficulty

V1 provides:

- Easy
- Medium
- Hard

Difficulty is independent from Bloom level.

For example, the system may generate:

> Medium difficulty + Analyze

or:

> Hard difficulty + Understand

These dimensions must not be conflated.

## 6.4 Question Style

V1 supports a multi-dimensional style taxonomy including:

- Conceptual
- Comparative
- Application-based
- Scenario-based
- Case-based
- Analytical
- Cause-and-effect
- Problem-solving
- Evaluative
- Design/Synthesis

The final implementation may consolidate overlapping style labels if required for consistency, but the product must preserve the concept of style as a dimension independent from Bloom and difficulty.

## 6.5 Topic

Questions may be constrained to:

- the entire project topic map,
- selected topics,
- weighted topic distributions.

## 6.6 Question Count

The user chooses how many questions to generate per request.

The V1 implementation should support batch generation rather than requiring one-question-at-a-time interaction.

A practical V1 implementation ceiling may be imposed to control local inference time and memory usage.

## 6.7 Distribution Weights

Users can define distributions across dimensions.

Example:

```text
20 Questions

Bloom:
Apply       25%
Analyze     45%
Evaluate    30%

Difficulty:
Medium      40%
Hard        60%

Style:
Scenario    40%
Analytical  40%
Comparative 20%
```

The generation planner should convert these requirements into a concrete question blueprint before generation.

---

# 7. Generation Presets

To avoid forcing users to configure every dimension manually every time, V1 should provide reusable presets.

Example presets include:

### Exam Preparation
Balanced mixture of medium/hard questions with Apply/Analyze emphasis.

### Deep Understanding
Strong Apply/Analyze emphasis with conceptual and comparative styles.

### High-Order Thinking
Heavy Analyze/Evaluate/Create distribution with scenario, analytical and evaluative styles.

### Revision
Broader topic coverage with a balanced mix of difficulty and cognition.

Presets are configuration templates, not separate AI systems.

Users may customize any preset before generation.

A fully custom mode must also be available.

---

# 8. Duplicate Policy

Duplicate detection is **project-scoped**, not global across the user's entire account.

Before generation, the user may choose whether existing project questions should be considered during duplicate detection.

### Avoid Duplicates
The system compares newly generated questions against:

- other questions in the current generation batch,
- previously stored questions in the same project.

### Allow Duplicates
Existing project questions do not block generation, although duplicates inside the same generation batch should still be detected where practical.

The system should use semantic similarity rather than exact string matching alone.

For example:

```text
What is the purpose of virtual memory?

Why is virtual memory required in an operating system?
```

should be treated as potentially duplicative even though the text differs.

---

# 9. Resource Management

A project may contain multiple study resources.

Example:

```text
DBMS Project
├── TeacherNotes.pdf
├── Unit3Slides.pptx
└── ReferenceChapter.docx
```

These resources form the project's local knowledge base.

At generation time, the system retrieves relevant chunks from this project knowledge base.

Each generated question should retain provenance information such as:

- source resource,
- page or slide where available,
- retrieved chunk/reference,
- topic association.

---

# 10. Topic Map Generation

When resources are uploaded, the system should derive a topic/knowledge structure from the material.

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

The extracted structure is **not automatically treated as an official syllabus** unless the user has actually supplied a syllabus.

Users must be able to edit the topic map because automatic LLM extraction may be incomplete or inaccurate.

Supported operations should include:

- add,
- rename,
- delete,
- merge,
- reorganize,
- reorder.

The edited topic map becomes part of the generation configuration.

---

# 11. Optional PYQ Analysis

Previous-year question papers are optional resources.

The core system must work without them.

When PYQs are supplied, the system may extract:

- topic distribution,
- question-format distribution,
- marks distribution when available,
- recurring concepts,
- structural patterns,
- approximate assessment characteristics.

The system should use these patterns to influence **new question generation**, not simply paraphrase existing questions.

PYQ-derived generation remains subordinate to grounding in the current project's study resources.

---

# 12. Question Generation Pipeline

The V1 generation pipeline should follow these conceptual stages.

## Step 1: Validate Generation Request

Verify:

- project exists,
- resources exist and are processed,
- requested question count is valid,
- requested distributions are valid,
- selected topics exist,
- selected Bloom levels/styles/difficulties are valid.

## Step 2: Build Question Blueprint

Translate user configuration into a concrete target distribution.

Example:

```text
20 questions
6 Apply
9 Analyze
5 Evaluate
```

## Step 3: Select Target Topic

Choose topic according to explicit user selection or configured topic weights.

## Step 4: Retrieve Relevant Context

Retrieve relevant chunks from the project's vector knowledge base using the selected topic and generation requirements.

## Step 5: Generate Candidate

The lightweight local LLM generates one structured candidate question at a time or an implementation-defined small batch.

## Step 6: Validate Candidate

Run the candidate through the validation pipeline.

## Step 7: Accept / Reject

Accepted questions enter the batch and project question bank.

Rejected questions enter regeneration.

## Step 8: Regenerate

Retry while the retry limit has not been reached.

## Step 9: Manual Review

If an item repeatedly fails, mark it as requiring manual review rather than weakening constraints.

---

# 13. Validation Engine

Validation is a central subsystem of the product.

## 13.1 Grounding Validation

The validator should determine whether the generated **question itself** is meaningfully supported by the supplied resources.

It must not reject higher-order questions merely because their final answers are not explicitly written in the source.

The validator should inspect:

- concepts used,
- relationships between concepts,
- terminology,
- context,
- scenario construction,
- source evidence.

## 13.2 Topic Alignment

Determine whether the question actually addresses the selected topic.

## 13.3 Bloom Alignment

Determine whether the generated question matches the requested Bloom level.

Example failure:

Requested:

```text
Analyze
```

Generated:

```text
Define process synchronization.
```

The question should be rejected as cognitively misaligned.

## 13.4 Difficulty Alignment

Determine whether the generated question reasonably matches the requested Easy/Medium/Hard level.

Difficulty must be treated separately from Bloom classification.

## 13.5 Style Alignment

Determine whether the question follows the selected style.

For example, a Scenario-based request should not return a direct definition question.

## 13.6 Structural Validation

Check that the question satisfies its selected format.

For MCQs, additionally check:

- valid option count,
- exactly one correct option,
- no duplicated options,
- no obviously malformed distractors,
- no accidentally correct distractors.

## 13.7 Semantic Duplicate Validation

Compare candidate questions against the configured duplicate scope using semantic similarity.

## 13.8 Batch Diversity Validation

Evaluate the generated set as a whole for excessive repetition in:

- topic,
- concepts,
- source passages,
- question structures,
- semantic content,
- cognitive level where applicable.

---

# 14. Validation Transparency

The user must be able to see structured validation outcomes.

Example:

```text
Grounding       PASS
Topic           PASS
Bloom           PASS
Difficulty      FAIL
Style           PASS
Duplicate       FAIL

Duplicate reason:
Semantic similarity with Question #7 = 0.89
```

The system should provide **validation evidence and concise reasons**, not hidden model chain-of-thought.

The user should understand why a question passed, failed, or was sent for review.

---

# 15. Regeneration and Manual Review

A failed question should not immediately appear as accepted.

Expected flow:

```text
Candidate
   ↓
Validation
   ↓
FAIL
   ↓
Regenerate
   ↓
Validation
   ↓
...
   ↓
Retry limit reached
   ↓
NEEDS REVIEW
```

The system must never silently alter:

- requested Bloom level,
- requested difficulty,
- requested style,
- selected topic,
- duplicate policy,
- other explicit generation constraints.

A generation request may therefore finish with fewer accepted questions than requested if the remaining candidates cannot satisfy the configured requirements.

---

# 16. Question Bank

Every generated question belongs to a project.

A question record should conceptually retain:

- question text,
- question format,
- options where applicable,
- correct answer where applicable,
- topic,
- Bloom level,
- difficulty,
- question style,
- source references,
- generation configuration,
- validation results,
- validation status,
- duplicate-check result,
- generation attempt/retry information,
- creation timestamp,
- status.

The question bank should support:

- browse,
- search,
- filtering,
- viewing source evidence,
- approval/rejection,
- regeneration,
- deletion,
- relevant editing.

---

# 17. Question Lifecycle

V1 question states should conceptually include:

```text
GENERATED
   ↓
VALIDATING
   ↓
VALIDATED
   ↓
APPROVED / AVAILABLE
```

Alternative paths:

```text
VALIDATING
   ↓
FAILED
   ↓
REGENERATING
   ↓
VALIDATED
```

or:

```text
FAILED
   ↓
NEEDS_REVIEW
```

The exact persisted state names may be refined during the database design phase.

---

# 18. Subjective Questions in V1

For short-answer and long-answer questions, V1 focuses on **question generation only**.

The primary user-facing output is the question itself.

V1 does not require:

- automated grading,
- student-submitted answers,
- answer scoring,
- detailed canonical answers,
- model-generated grading rubrics.

Supporting metadata and source evidence may still exist internally for validation and provenance.

---

# 19. Authentication and User Data

Authentication is required in V1.

This is necessary because the platform maintains persistent project-level data, including:

- projects,
- resources,
- topic maps,
- question banks,
- generation history.

Every project belongs to an authenticated user.

Every project resource and generated question must be isolated by project ownership.

There is no teacher/student role model in V1.

---

# 20. AI / Model Strategy

V1 uses one lightweight local LLM served locally, preferably through Ollama or an equivalent local inference interface.

The product must not require:

- paid LLM APIs,
- cloud model subscriptions,
- dedicated GPUs,
- proprietary inference infrastructure.

The exact model selected for implementation will be finalized during technical architecture and benchmarking.

The software should still keep the inference boundary sufficiently modular that a future API provider can be introduced without rewriting the complete application.

V1 does not expose model selection to users.

V1 does not provide model-comparison experiments to users.

---

# 21. Retrieval Strategy

V1 uses a local RAG pipeline.

Conceptually:

```text
Resource
  ↓
Text extraction
  ↓
Chunking + metadata
  ↓
Local embedding model
  ↓
Vector database
  ↓
Top-k retrieval
  ↓
Context assembly
  ↓
Local LLM
```

The retrieval layer should remain project-scoped.

The system must not retrieve content from another user's project.

---

# 22. Frontend Experience

The V1 interface should make the generation process understandable without exposing unnecessary AI implementation details.

Primary user flow:

```text
Login
  ↓
Projects
  ↓
Create/Open Project
  ↓
Upload Resources
  ↓
Review/Edit Topic Map
  ↓
Create Generation Blueprint
  ↓
Generate Questions
  ↓
View Validation Status
  ↓
Review Accepted / Needs-Review Questions
  ↓
Question Bank
```

The generation screen should provide controls for:

- number of questions,
- topic selection,
- Bloom distribution,
- difficulty distribution,
- question-format distribution,
- style distribution,
- duplicate policy,
- preset selection.

---

# 23. Non-Functional Requirements

## Performance

The system should be usable on a normal consumer laptop without a dedicated GPU.

Generation may be slower than cloud commercial models; correctness, controllability, and local feasibility are higher priorities than raw generation speed.

## Privacy

Uploaded study material should remain local to the deployment wherever practical.

No external web retrieval should occur during question generation.

## Reliability

Generation failures should not corrupt stored questions or project data.

Partial generation results should be recoverable.

## Reproducibility

Generation metadata should be retained sufficiently to reproduce or analyze an earlier generation request where technically feasible.

## Explainability

Validation outcomes should be visible in structured form.

## Extensibility

Future APIs, model providers, additional formats, numerical validation, and research experiments should be possible without redesigning the entire domain model.

---

# 24. Technology Constraints

The initial implementation is expected to use a web-based stack with:

### Frontend
- React
- Tailwind CSS
- shadcn/ui or equivalent component system

### Backend
- Node.js
- Express or equivalent Node backend framework

### AI / RAG
- Local LLM runtime such as Ollama
- Local embedding model
- Local vector database such as FAISS/Chroma or an equivalent implementation

### Storage
- Relational database for application data
- Local/object storage strategy for resource files
- Vector storage for embeddings

Exact technology choices are to be finalized in the database and system-architecture documents.

---

# 25. V1 Feature Priorities

## P0 - Core / Mandatory

1. Authentication
2. Project creation
3. PDF/DOCX/PPTX upload
4. Multiple resources per project
5. Resource processing
6. Topic-map extraction
7. Topic-map editing
8. RAG retrieval
9. Local lightweight LLM generation
10. Question count control
11. Question-format control
12. Bloom-level control
13. Difficulty control
14. Question-style control
15. Topic control
16. Weighted distributions
17. Generation presets
18. Project-level duplicate detection
19. Source grounding validation
20. Bloom validation
21. Difficulty validation
22. Style validation
23. Structural validation
24. Semantic duplicate detection
25. Diversity validation
26. Automatic regeneration
27. Maximum retry handling
28. Manual-review state
29. Visible validation reasoning
30. Persistent question bank
31. Question filtering/search
32. Source provenance

## P1 - Important but Secondary

1. Optional PYQ pattern analysis
2. PYQ-pattern-based generation mode
3. Question status management
4. Generation history
5. Advanced provenance display
6. Preset customization/storage

## P2 - Deferred / Future

1. Numerical question generation
2. Deterministic numerical solver validation
3. OCR/scanned-document support
4. Additional document types
5. Multi-model selection
6. Cloud LLM providers
7. Automatic grading
8. Adaptive learning
9. Student performance analytics
10. Personalized learning paths
11. Tutor chatbot
12. Research/ablation dashboard
13. Model comparison UI

---

# 26. Explicitly Out of Scope for V1

The following must not silently creep into the implementation merely because they look impressive in a demo:

- Automatic grading
- Student answer evaluation
- Adaptive learning
- Personalized learning paths
- Performance prediction
- Tutor/chatbot functionality
- Web search during generation
- User-facing multi-model comparison
- Research experiment dashboard
- Model fine-tuning as a required component
- Numerical-question generation as a core V1 requirement
- OCR as a mandatory document-processing path

These may become future extensions, but they are not part of the frozen V1 product scope.

---

# 27. Success Criteria

The project should be considered successful when a user can:

1. Create an authenticated project.
2. Upload one or more supported study resources.
3. Obtain an automatically generated and editable topic map.
4. Configure a multi-dimensional question blueprint.
5. Generate questions locally without a paid API.
6. Obtain questions that demonstrate higher-order cognitive variation rather than only factual recall.
7. See source evidence for generated questions.
8. See structured validation results.
9. Avoid semantic duplicates within a project when duplicate prevention is enabled.
10. Receive regeneration attempts when candidates fail validation.
11. Receive a manual-review state instead of silently receiving lower-quality questions when constraints cannot be met.
12. Persist and manage all generated questions inside the project question bank.

---

# 28. Product-Level Research Direction

Although the V1 product does not expose a research dashboard, the architecture is intentionally designed around a researchable hypothesis:

> A lightweight local LLM combined with retrieval, explicit generation constraints, independent validation, semantic duplicate detection, and regeneration can produce more controllable and reliable educational questions than unconstrained direct generation.

The major experimental dimensions enabled by the product are:

- direct LLM generation vs RAG,
- RAG vs controlled generation,
- controlled generation vs validation + regeneration,
- grounding quality,
- Bloom alignment,
- difficulty alignment,
- diversity,
- duplicate rate,
- syllabus/topic coverage,
- human evaluation correlation.

These experiments are intentionally separated from the V1 end-user experience.

---

# 29. Future Document Dependencies

This PRD is the source-of-truth for the next engineering documents.

The next documents should be derived from this specification in the following order:

```text
PRD / Product Description
        ↓
Domain Model / Database Design
        ↓
API Specification
        ↓
System Design Architecture
        ↓
AI / RAG Pipeline Specification
        ↓
Validation Algorithm Specification
        ↓
Implementation Scaffold
```

Any feature added later should be reflected consistently across these artifacts.

---

# 30. Final V1 Product Definition

The final V1 product is:

> **An authenticated, role-neutral, resource-grounded educational question-generation platform that uses a lightweight local LLM and RAG to generate configurable high-order questions across multiple independent dimensions such as question format, Bloom cognitive level, difficulty, topic, and question style. The system validates generated questions for grounding, cognitive and structural alignment, semantic duplication, and diversity, automatically regenerates failed candidates, and routes unresolved failures to manual review without silently relaxing user constraints.**

The platform generates questions only. Grading, adaptive learning, tutoring, and student-performance systems are outside the V1 boundary.

---

## Status

**Feature scope: LOCKED for the current development phase.**

Future architectural documents should derive their entities, APIs, workflows, and system components from this PRD rather than independently redefining product behavior.
