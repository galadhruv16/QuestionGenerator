-- GroundQ Migration: Course Topics and Chunk-Topic Mappings
-- Migration: 202610110003_topics_and_chunk_mappings.sql

-- 1. Create topics table (strictly 2-level hierarchy in V1)
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  parent_id uuid references public.topics (id) on delete restrict,
  name text not null,
  description text,
  source text not null check (source in ('INFERRED', 'USER_DEFINED', 'IMPORTED')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Unique index to prevent duplicate sibling topic names among active topics within the same parent/project
create unique index if not exists topics_project_parent_name_idx
  on public.topics (project_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)))
  where (archived_at is null);

-- Query and sorting indexes
create index if not exists topics_project_idx on public.topics (project_id);
create index if not exists topics_parent_idx on public.topics (parent_id);
create index if not exists topics_sort_idx on public.topics (project_id, parent_id, sort_order);

-- 2. Create chunk_topics table (many-to-many relationship)
create table if not exists public.chunk_topics (
  chunk_id uuid not null references public.resource_chunks (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'AUTO_INFERRED' check (source in ('AUTO_INFERRED', 'USER_ASSIGNED')),
  created_at timestamptz not null default now(),
  primary key (chunk_id, topic_id)
);

create index if not exists chunk_topics_topic_idx on public.chunk_topics (topic_id);
create index if not exists chunk_topics_chunk_idx on public.chunk_topics (chunk_id);

-- 3. Enable RLS
alter table public.topics enable row level security;
alter table public.chunk_topics enable row level security;

-- Topics RLS
drop policy if exists "Users can view topics in their own projects" on public.topics;
create policy "Users can view topics in their own projects"
  on public.topics for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = topics.project_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can insert topics in their own projects" on public.topics;
create policy "Users can insert topics in their own projects"
  on public.topics for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = topics.project_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can update topics in their own projects" on public.topics;
create policy "Users can update topics in their own projects"
  on public.topics for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = topics.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = topics.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- Chunk-topics RLS
drop policy if exists "Users can view chunk mappings in their own projects" on public.chunk_topics;
create policy "Users can view chunk mappings in their own projects"
  on public.chunk_topics for select
  using (
    exists (
      select 1 from public.topics
      join public.projects on projects.id = topics.project_id
      where topics.id = chunk_topics.topic_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can manage chunk mappings in their own projects" on public.chunk_topics;
create policy "Users can manage chunk mappings in their own projects"
  on public.chunk_topics for all
  using (
    exists (
      select 1 from public.topics
      join public.projects on projects.id = topics.project_id
      where topics.id = chunk_topics.topic_id
        and projects.owner_id = auth.uid()
    )
  );
