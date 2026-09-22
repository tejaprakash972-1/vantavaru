-- Run this once in the Supabase SQL editor.
-- The bucket is private because it contains identity documents.
insert into storage.buckets (id, name, public)
values ('cookDocuments', 'cookDocuments', false)
on conflict (id) do update set public = false;

alter table public.profiles enable row level security;
alter table public.cook_profiles enable row level security;
alter table public.cook_documents enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
    or coalesce((select auth.jwt()->'user_metadata'->>'role'), '') = 'admin'
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

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

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles for select to authenticated
using (
  coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
  or coalesce((select auth.jwt()->'user_metadata'->>'role'), '') = 'admin'
  or id = (select auth.uid())
);

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

drop policy if exists "Admins can view all cook profiles" on public.cook_profiles;
drop policy if exists "Admins can update cook profiles" on public.cook_profiles;
create policy "Admins can view all cook profiles"
on public.cook_profiles for select to authenticated
using (
  coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
  or coalesce((select auth.jwt()->'user_metadata'->>'role'), '') = 'admin'
  or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin')
);
create policy "Admins can update cook profiles"
on public.cook_profiles for update to authenticated
using (
  coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
  or coalesce((select auth.jwt()->'user_metadata'->>'role'), '') = 'admin'
  or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin')
)
with check (
  coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
  or coalesce((select auth.jwt()->'user_metadata'->>'role'), '') = 'admin'
  or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin')
);

drop policy if exists "Cooks can view their own document rows" on public.cook_documents;
drop policy if exists "Cooks can create their own document rows" on public.cook_documents;
create policy "Cooks can view their own document rows"
on public.cook_documents for select to authenticated
using (cook_id in (select id from public.cook_profiles where user_id = (select auth.uid())));
create policy "Cooks can create their own document rows"
on public.cook_documents for insert to authenticated
with check (cook_id in (select id from public.cook_profiles where user_id = (select auth.uid())));

drop policy if exists "Admins can view all cook documents" on public.cook_documents;
create policy "Admins can view all cook documents"
on public.cook_documents for select to authenticated
using (
  coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
  or coalesce((select auth.jwt()->'user_metadata'->>'role'), '') = 'admin'
  or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin')
);

drop policy if exists "Admins can update cook documents" on public.cook_documents;
create policy "Admins can update cook documents"
on public.cook_documents
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

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

drop policy if exists "Admins can view cook document files" on storage.objects;
create policy "Admins can view cook document files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cookDocuments'
  and (
    coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
    or coalesce((select auth.jwt()->'user_metadata'->>'role'), '') = 'admin'
  )
);

create or replace function public.admin_get_cooks()
returns table (
  id uuid,
  user_id uuid,
  phone text,
  full_name text,
  date_of_birth date,
  gender text,
  cooking_experience text,
  cuisines text[],
  languages text[],
  house_flat_no text,
  street_area text,
  city text,
  pincode text,
  landmark text,
  service_radius_km numeric,
  status text,
  rejection_reason text,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    cp.id,
    cp.user_id,
    coalesce(au.phone, profile.phone) as phone,
    cp.full_name,
    cp.date_of_birth,
    cp.gender,
    cp.cooking_experience,
    cp.cuisines,
    cp.languages,
    cp.house_flat_no,
    cp.street_area,
    cp.city,
    cp.pincode,
    cp.landmark,
    cp.service_radius_km,
    cp.status::text,
    cp.rejection_reason,
    cp.submitted_at
  from public.cook_profiles cp
  join auth.users au on au.id = cp.user_id
  left join public.profiles profile on profile.id = cp.user_id
  where
    coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
    or coalesce((select auth.jwt()->'user_metadata'->>'role'), '') = 'admin'
    or exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = (select auth.uid())
        and admin_profile.role = 'admin'
    )
  order by cp.submitted_at desc nulls last;
$$;

revoke all on function public.admin_get_cooks() from public;
grant execute on function public.admin_get_cooks() to authenticated;

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
