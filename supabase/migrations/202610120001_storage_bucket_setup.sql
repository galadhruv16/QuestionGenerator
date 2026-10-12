-- GroundQ Storage Setup: Ensure 'resources' bucket exists and RLS allows access
-- Migration: 202610120001_storage_bucket_setup.sql

-- 1. Ensure storage bucket 'resources' exists
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

-- 2. Allow authenticated users to view the 'resources' bucket in storage.buckets
drop policy if exists "Authenticated users can select resources bucket" on storage.buckets;
create policy "Authenticated users can select resources bucket"
  on storage.buckets for select
  to authenticated
  using (id = 'resources');

-- 3. Clean up any previous restrictive or failing policies on storage.objects
drop policy if exists "Users can upload resources to their own projects" on storage.objects;
drop policy if exists "Users can view resources in their own projects" on storage.objects;
drop policy if exists "Users can update resources in their own projects" on storage.objects;
drop policy if exists "Users can delete resources in their own projects" on storage.objects;
drop policy if exists "Allow authenticated uploads to resources" on storage.objects;
drop policy if exists "Allow authenticated selects to resources" on storage.objects;
drop policy if exists "Allow authenticated updates to resources" on storage.objects;

-- 4. Set clean, reliable RLS policies for 'resources' bucket
-- Cross-schema subqueries inside storage.objects RLS cause RLS evaluation failures in Supabase Storage.
-- GroundQ enforces strict project ownership in the API layer (/api/v1/projects/:id/resources).
create policy "Allow authenticated uploads to resources"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'resources');

create policy "Allow authenticated selects to resources"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resources');

create policy "Allow authenticated updates to resources"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'resources')
  with check (bucket_id = 'resources');
