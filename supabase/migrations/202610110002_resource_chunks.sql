-- GroundQ Migration: Resource Chunks and Vector Embeddings
-- Migration: 202610110002_resource_chunks.sql

-- Enable pgvector extension if not already enabled
create extension if not exists vector;

-- Create resource_chunks table
create table if not exists public.resource_chunks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete restrict,
  processing_run_id uuid not null references public.resource_processing_runs (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  chunk_index integer not null check (chunk_index >= 0),
  text text not null,
  page_number integer check (page_number is null or page_number >= 1),
  slide_number integer check (slide_number is null or slide_number >= 1),
  section_title text,
  token_count integer check (token_count is null or token_count >= 0),
  embedding vector(768),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Unique index to guarantee chunk sequence within a processing run
create unique index if not exists resource_chunks_run_chunk_idx
  on public.resource_chunks (processing_run_id, chunk_index);

-- Query indexes
create index if not exists resource_chunks_resource_idx
  on public.resource_chunks (resource_id, processing_run_id);
create index if not exists resource_chunks_project_idx
  on public.resource_chunks (project_id);

-- Enable RLS
alter table public.resource_chunks enable row level security;

drop policy if exists "Users can view chunks in their own projects" on public.resource_chunks;
create policy "Users can view chunks in their own projects"
  on public.resource_chunks for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = resource_chunks.project_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can insert chunks in their own projects" on public.resource_chunks;
create policy "Users can insert chunks in their own projects"
  on public.resource_chunks for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = resource_chunks.project_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can update chunks in their own projects" on public.resource_chunks;
create policy "Users can update chunks in their own projects"
  on public.resource_chunks for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = resource_chunks.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = resource_chunks.project_id
        and projects.owner_id = auth.uid()
    )
  );
