-- Run this once in the Supabase SQL editor.
-- The bucket is private because it contains identity documents.
insert into storage.buckets (id, name, public)
values ('cookDocuments', 'cookDocuments', false)
on conflict (id) do update set public = false;

alter table public.profiles enable row level security;
alter table public.cook_profiles enable row level security;
alter table public.cook_documents enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Cooks can view their own cook profile" on public.cook_profiles;
drop policy if exists "Cooks can create their own cook profile" on public.cook_profiles;
drop policy if exists "Cooks can update their own cook profile" on public.cook_profiles;
create policy "Cooks can view their own cook profile"
on public.cook_profiles for select to authenticated
using (user_id = (select auth.uid()));
create policy "Cooks can create their own cook profile"
on public.cook_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Cooks can update their own cook profile"
on public.cook_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Cooks can view their own document rows" on public.cook_documents;
drop policy if exists "Cooks can create their own document rows" on public.cook_documents;
create policy "Cooks can view their own document rows"
on public.cook_documents for select to authenticated
using (cook_id in (select id from public.cook_profiles where user_id = (select auth.uid())));
create policy "Cooks can create their own document rows"
on public.cook_documents for insert to authenticated
with check (cook_id in (select id from public.cook_profiles where user_id = (select auth.uid())));

drop policy if exists "Cook documents can be uploaded by their owner" on storage.objects;
drop policy if exists "Cook documents can be viewed by their owner" on storage.objects;
drop policy if exists "Cook documents can be replaced by their owner" on storage.objects;
drop policy if exists "Cook documents can be deleted by their owner" on storage.objects;
create policy "Cook documents can be uploaded by their owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cookDocuments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Cook documents can be viewed by their owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cookDocuments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Cook documents can be replaced by their owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cookDocuments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'cookDocuments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Cook documents can be deleted by their owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cookDocuments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
