-- 202610120002_generation_and_questions.sql
-- GroundQ V1: Reference tables, generation presets, generation blueprints,
-- generation runs, plan items, attempts, questions, versions, options, source references,
-- and validation tables.

-- ============================================================================
-- 1. Reference Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bloom_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.difficulty_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.question_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.question_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Reference Tables
INSERT INTO public.bloom_levels (slug, name, description, display_order)
VALUES
    ('remember', 'Remember', 'Definitions, terminology, syntax, and foundational recall', 1),
    ('understand', 'Understand', 'Conceptual workflows, explanation, and principle mapping', 2),
    ('apply', 'Apply', 'Implementation tracing, code execution, and algorithmic problem solving', 3),
    ('analyze', 'Analyze', 'Fault analysis, structural comparison, edge cases, and invariants', 4),
    ('evaluate', 'Evaluate', 'Trade-offs, performance critique, complexity, and safety verification', 5),
    ('create', 'Synthesize', 'Architecture composition, algorithm design, and system integration', 6)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO public.difficulty_levels (slug, name, description, display_order)
VALUES
    ('EASY', 'Easy', 'Direct, foundational single-step concepts', 1),
    ('MEDIUM', 'Medium', 'Multi-step reasoning and standard curriculum assessment', 2),
    ('HARD', 'Hard', 'Multi-concept synthesis, non-trivial edge cases, or proofs', 3)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO public.question_types (slug, name, description, display_order)
VALUES
    ('MCQ', 'Multiple Choice (MCQ)', 'Single-select 4-distractor question with verified rationale', 1),
    ('SHORT_ANSWER', 'Short Answer / Proofs', 'Concise conceptual answer or proof with rubric key', 2),
    ('LONG_ANSWER', 'Long Scenario Analysis', 'Comprehensive case study or architecture problem with criteria', 3)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, display_order = EXCLUDED.display_order;

INSERT INTO public.question_styles (slug, name, description, display_order)
VALUES
    ('CONCEPTUAL', 'Direct Conceptual', 'Straightforward conceptual examination of syllabus knowledge', 1),
    ('SCENARIO', 'Scenario-Based', 'Realistic application scenario or hypothetical system state', 2),
    ('ANALYTICAL', 'Direct Analytical', 'Rigorous step-by-step mathematical or algorithmic analysis', 3),
    ('COMPARATIVE', 'Comparative', 'Explicit contrast and trade-off comparison between two approaches', 4),
    ('CASE_BASED', 'Case-Based', 'In-depth situational case requiring structured deduction', 5),
    ('DESIGN_SYNTHESIS', 'Design & Synthesis', 'Constructive protocol or system design problem', 6)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, display_order = EXCLUDED.display_order;

-- Enable RLS for reference tables (readable by authenticated users)
ALTER TABLE public.bloom_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.difficulty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_styles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bloom_levels' AND policyname = 'bloom_levels_select') THEN
        CREATE POLICY bloom_levels_select ON public.bloom_levels FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'difficulty_levels' AND policyname = 'difficulty_levels_select') THEN
        CREATE POLICY difficulty_levels_select ON public.difficulty_levels FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'question_types' AND policyname = 'question_types_select') THEN
        CREATE POLICY question_types_select ON public.question_types FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'question_styles' AND policyname = 'question_styles_select') THEN
        CREATE POLICY question_styles_select ON public.question_styles FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- ============================================================================
-- 2. Generation Presets & Blueprints
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.generation_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    configuration JSONB NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.generation_blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ
);

-- Seed System Presets
INSERT INTO public.generation_presets (name, description, configuration, is_system)
VALUES
(
    'Balanced Exam Prep',
    'Comprehensive syllabus coverage across standard assessment modalities and Bloom tiers.',
    '{
        "question_count": 15,
        "bloom": { "remember": 10, "understand": 15, "apply": 25, "analyze": 30, "evaluate": 15, "create": 5 },
        "difficulty": { "easy": 20, "medium": 50, "hard": 30 },
        "types": { "mcq": 50, "short_answer": 30, "long_answer": 20 },
        "styles": { "scenario": 40, "analytical": 40, "conceptual": 20 },
        "duplicate_policy": "PREVENT"
    }'::jsonb,
    true
),
(
    'High-Order Analytical',
    'Heavy focus on scenario reasoning, edge case analysis, trade-off proofs, and evaluation.',
    '{
        "question_count": 10,
        "bloom": { "remember": 0, "understand": 10, "apply": 20, "analyze": 40, "evaluate": 20, "create": 10 },
        "difficulty": { "easy": 0, "medium": 40, "hard": 60 },
        "types": { "mcq": 40, "short_answer": 30, "long_answer": 30 },
        "styles": { "scenario": 50, "analytical": 30, "comparative": 20 },
        "duplicate_policy": "PREVENT"
    }'::jsonb,
    true
),
(
    'Foundational Recall',
    'Syntax tracing, terminology recall, core definitions, and conceptual workflow recognition.',
    '{
        "question_count": 20,
        "bloom": { "remember": 40, "understand": 40, "apply": 20, "analyze": 0, "evaluate": 0, "create": 0 },
        "difficulty": { "easy": 50, "medium": 40, "hard": 10 },
        "types": { "mcq": 80, "short_answer": 20, "long_answer": 0 },
        "styles": { "conceptual": 70, "analytical": 30 },
        "duplicate_policy": "PREVENT"
    }'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- RLS for Presets & Blueprints
ALTER TABLE public.generation_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_blueprints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generation_presets' AND policyname = 'presets_select') THEN
        CREATE POLICY presets_select ON public.generation_presets
            FOR SELECT TO authenticated
            USING (is_system = true OR owner_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generation_presets' AND policyname = 'presets_manage') THEN
        CREATE POLICY presets_manage ON public.generation_presets
            FOR ALL TO authenticated
            USING (owner_id = auth.uid())
            WITH CHECK (owner_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generation_blueprints' AND policyname = 'blueprints_manage') THEN
        CREATE POLICY blueprints_manage ON public.generation_blueprints
            FOR ALL TO authenticated
            USING (created_by = auth.uid())
            WITH CHECK (created_by = auth.uid());
    END IF;
END $$;

-- ============================================================================
-- 3. Generation Runs, Plan Items & Attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.generation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    blueprint_id UUID REFERENCES public.generation_blueprints(id) ON DELETE SET NULL,
    blueprint_snapshot JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'CREATED',
    requested_count INTEGER NOT NULL,
    accepted_count INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    duplicate_policy TEXT NOT NULL DEFAULT 'PREVENT',
    model_provider TEXT NOT NULL DEFAULT 'ollama',
    model_name TEXT NOT NULL DEFAULT 'llama3',
    model_version TEXT,
    embedding_model TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.generation_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_run_id UUID NOT NULL REFERENCES public.generation_runs(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    question_type_id UUID REFERENCES public.question_types(id) ON DELETE SET NULL,
    bloom_level_id UUID REFERENCES public.bloom_levels(id) ON DELETE SET NULL,
    difficulty_level_id UUID REFERENCES public.difficulty_levels(id) ON DELETE SET NULL,
    style_id UUID REFERENCES public.question_styles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_plan_sequence UNIQUE (generation_run_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS public.generation_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_run_id UUID NOT NULL REFERENCES public.generation_runs(id) ON DELETE CASCADE,
    plan_item_id UUID NOT NULL REFERENCES public.generation_plan_items(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'GENERATED',
    model_name TEXT NOT NULL,
    prompt_version TEXT,
    raw_output TEXT,
    parsed_output JSONB,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- RLS for Runs, Plan Items & Attempts
ALTER TABLE public.generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generation_runs' AND policyname = 'generation_runs_manage') THEN
        CREATE POLICY generation_runs_manage ON public.generation_runs
            FOR ALL TO authenticated
            USING (created_by = auth.uid())
            WITH CHECK (created_by = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generation_plan_items' AND policyname = 'plan_items_manage') THEN
        CREATE POLICY plan_items_manage ON public.generation_plan_items
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.generation_runs gr WHERE gr.id = generation_plan_items.generation_run_id AND gr.created_by = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.generation_runs gr WHERE gr.id = generation_plan_items.generation_run_id AND gr.created_by = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generation_attempts' AND policyname = 'attempts_manage') THEN
        CREATE POLICY attempts_manage ON public.generation_attempts
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.generation_runs gr WHERE gr.id = generation_attempts.generation_run_id AND gr.created_by = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.generation_runs gr WHERE gr.id = generation_attempts.generation_run_id AND gr.created_by = auth.uid()));
    END IF;
END $$;

-- ============================================================================
-- 4. Questions, Question Versions, Options & Source References
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    generation_run_id UUID REFERENCES public.generation_runs(id) ON DELETE SET NULL,
    generation_plan_item_id UUID REFERENCES public.generation_plan_items(id) ON DELETE SET NULL,
    current_version_id UUID,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.question_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    question_text TEXT NOT NULL,
    question_type_id UUID REFERENCES public.question_types(id) ON DELETE SET NULL,
    bloom_level_id UUID REFERENCES public.bloom_levels(id) ON DELETE SET NULL,
    difficulty_level_id UUID REFERENCES public.difficulty_levels(id) ON DELETE SET NULL,
    style_id UUID REFERENCES public.question_styles(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    origin TEXT NOT NULL DEFAULT 'AI_GENERATED',
    model_answer TEXT,
    explanation TEXT,
    rubric_criteria JSONB,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    source_attempt_id UUID REFERENCES public.generation_attempts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_question_version UNIQUE (question_id, version_number)
);

-- Back-reference foreign key for current_version_id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_questions_current_version'
    ) THEN
        ALTER TABLE public.questions
        ADD CONSTRAINT fk_questions_current_version
        FOREIGN KEY (current_version_id) REFERENCES public.question_versions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_version_option UNIQUE (question_version_id, option_index)
);

CREATE TABLE IF NOT EXISTS public.question_source_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE CASCADE,
    chunk_id UUID NOT NULL REFERENCES public.resource_chunks(id) ON DELETE CASCADE,
    relevance_score NUMERIC(7,6),
    evidence_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. Validation Runs & Validation Checks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.validation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE CASCADE,
    generation_attempt_id UUID REFERENCES public.generation_attempts(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    validator_version TEXT NOT NULL DEFAULT 'v1.0.0',
    overall_result TEXT NOT NULL DEFAULT 'PASS',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.validation_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_run_id UUID NOT NULL REFERENCES public.validation_runs(id) ON DELETE CASCADE,
    check_type TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'PASS',
    score NUMERIC(7,6),
    reason TEXT,
    evidence JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for Questions & Validation
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_source_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_checks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'questions_manage') THEN
        CREATE POLICY questions_manage ON public.questions
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = questions.project_id AND p.owner_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = questions.project_id AND p.owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'question_versions' AND policyname = 'versions_manage') THEN
        CREATE POLICY versions_manage ON public.question_versions
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.questions q JOIN public.projects p ON p.id = q.project_id WHERE q.id = question_versions.question_id AND p.owner_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.questions q JOIN public.projects p ON p.id = q.project_id WHERE q.id = question_versions.question_id AND p.owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'question_options' AND policyname = 'options_manage') THEN
        CREATE POLICY options_manage ON public.question_options
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.question_versions qv JOIN public.questions q ON q.id = qv.question_id JOIN public.projects p ON p.id = q.project_id WHERE qv.id = question_options.question_version_id AND p.owner_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.question_versions qv JOIN public.questions q ON q.id = qv.question_id JOIN public.projects p ON p.id = q.project_id WHERE qv.id = question_options.question_version_id AND p.owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'question_source_refs' AND policyname = 'source_refs_manage') THEN
        CREATE POLICY source_refs_manage ON public.question_source_refs
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.question_versions qv JOIN public.questions q ON q.id = qv.question_id JOIN public.projects p ON p.id = q.project_id WHERE qv.id = question_source_refs.question_version_id AND p.owner_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.question_versions qv JOIN public.questions q ON q.id = qv.question_id JOIN public.projects p ON p.id = q.project_id WHERE qv.id = question_source_refs.question_version_id AND p.owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'validation_runs' AND policyname = 'val_runs_manage') THEN
        CREATE POLICY val_runs_manage ON public.validation_runs
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.question_versions qv JOIN public.questions q ON q.id = qv.question_id JOIN public.projects p ON p.id = q.project_id WHERE qv.id = validation_runs.question_version_id AND p.owner_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.question_versions qv JOIN public.questions q ON q.id = qv.question_id JOIN public.projects p ON p.id = q.project_id WHERE qv.id = validation_runs.question_version_id AND p.owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'validation_checks' AND policyname = 'val_checks_manage') THEN
        CREATE POLICY val_checks_manage ON public.validation_checks
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.validation_runs vr JOIN public.question_versions qv ON qv.id = vr.question_version_id JOIN public.questions q ON q.id = qv.question_id JOIN public.projects p ON p.id = q.project_id WHERE vr.id = validation_checks.validation_run_id AND p.owner_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.validation_runs vr JOIN public.question_versions qv ON qv.id = vr.question_version_id JOIN public.questions q ON q.id = qv.question_id JOIN public.projects p ON p.id = q.project_id WHERE vr.id = validation_checks.validation_run_id AND p.owner_id = auth.uid()));
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blueprints_project ON public.generation_blueprints (project_id);
CREATE INDEX IF NOT EXISTS idx_runs_project ON public.generation_runs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_items_run ON public.generation_plan_items (generation_run_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_attempts_plan ON public.generation_attempts (plan_item_id);
CREATE INDEX IF NOT EXISTS idx_questions_project ON public.questions (project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_question_versions_question ON public.question_versions (question_id, version_number);
CREATE INDEX IF NOT EXISTS idx_question_options_version ON public.question_options (question_version_id, option_index);
CREATE INDEX IF NOT EXISTS idx_question_source_refs_version ON public.question_source_refs (question_version_id);
