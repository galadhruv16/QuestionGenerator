-- GroundQ Migration: Resources, Resource Processing Runs, and Supabase Storage
-- Migration: 202610110001_resources_and_processing.sql

-- 1. Create resources table
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  original_filename text not null,
  storage_path text not null,
  mime_type text not null,
  file_extension text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  resource_kind text not null check (resource_kind in ('STUDY_MATERIAL', 'PRESENTATION', 'PYQ', 'SYLLABUS', 'OTHER')),
  status text not null check (status in ('UPLOADING', 'READY_TO_PROCESS', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED')),
  page_count integer,
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Resources indexes
create index if not exists resources_project_id_status_idx on public.resources (project_id, status);
create index if not exists resources_project_id_archived_at_idx on public.resources (project_id, archived_at);
create index if not exists resources_project_id_created_at_idx on public.resources (project_id, created_at desc);

-- Set updated_at trigger
drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at
  before update on public.resources
  for each row execute procedure public.set_updated_at();

-- Resources RLS
alter table public.resources enable row level security;

drop policy if exists "Users can view resources in their own projects" on public.resources;
create policy "Users can view resources in their own projects"
  on public.resources for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = resources.project_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can create resources in their own projects" on public.resources;
create policy "Users can create resources in their own projects"
  on public.resources for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = resources.project_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can update resources in their own projects" on public.resources;
create policy "Users can update resources in their own projects"
  on public.resources for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = resources.project_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = resources.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- 2. Create resource_processing_runs table
create table if not exists public.resource_processing_runs (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete restrict,
  status text not null check (status in ('PENDING', 'RUNNING', 'READY', 'FAILED', 'CANCELLED')),
  parser_version text,
  chunking_version text,
  embedding_model text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Processing runs indexes
create index if not exists resource_processing_runs_resource_id_created_at_idx
  on public.resource_processing_runs (resource_id, created_at desc);
create index if not exists resource_processing_runs_resource_id_status_idx
  on public.resource_processing_runs (resource_id, status);

-- Processing runs RLS
alter table public.resource_processing_runs enable row level security;

drop policy if exists "Users can view processing runs of their resources" on public.resource_processing_runs;
create policy "Users can view processing runs of their resources"
  on public.resource_processing_runs for select
  using (
    exists (
      select 1 from public.resources
      join public.projects on projects.id = resources.project_id
      where resources.id = resource_processing_runs.resource_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can create processing runs for their resources" on public.resource_processing_runs;
create policy "Users can create processing runs for their resources"
  on public.resource_processing_runs for insert
  with check (
    exists (
      select 1 from public.resources
      join public.projects on projects.id = resources.project_id
      where resources.id = resource_processing_runs.resource_id
        and projects.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can update processing runs for their resources" on public.resource_processing_runs;
create policy "Users can update processing runs for their resources"
  on public.resource_processing_runs for update
  using (
    exists (
      select 1 from public.resources
      join public.projects on projects.id = resources.project_id
      where resources.id = resource_processing_runs.resource_id
        and projects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.resources
      join public.projects on projects.id = resources.project_id
      where resources.id = resource_processing_runs.resource_id
        and projects.owner_id = auth.uid()
    )
  );

-- 3. Configure Supabase Storage 'resources' bucket and RLS policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources',
  'resources',
  false,
  26214400, -- 25 MB limit
  array['application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = array['application/pdf'];

drop policy if exists "Users can upload resources to their own projects" on storage.objects;
create policy "Users can upload resources to their own projects"
  on storage.objects for insert
  with check (
    bucket_id = 'resources'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and exists (
      select 1 from public.projects
      where id = (split_part(name, '/', 1))::uuid
        and owner_id = auth.uid()
    )
  );

drop policy if exists "Users can view resources in their own projects" on storage.objects;
create policy "Users can view resources in their own projects"
  on storage.objects for select
  using (
    bucket_id = 'resources'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and exists (
      select 1 from public.projects
      where id = (split_part(name, '/', 1))::uuid
        and owner_id = auth.uid()
    )
  );

drop policy if exists "Users can update resources in their own projects" on storage.objects;
create policy "Users can update resources in their own projects"
  on storage.objects for update
  using (
    bucket_id = 'resources'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and exists (
      select 1 from public.projects
      where id = (split_part(name, '/', 1))::uuid
        and owner_id = auth.uid()
    )
  );
