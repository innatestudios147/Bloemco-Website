-- Bloem-Co staff blog: schema, roles and access rules.
--
-- Design notes (see README.md "Blog & staff portal" section for the full
-- picture):
--   * All article writes (create/update) go through the "posts-write" edge
--     function, which sanitizes the HTML body server-side before it ever
--     reaches this table. There is deliberately NO insert/update policy for
--     ordinary authenticated users on blog_posts — the edge function writes
--     with the service-role key, which bypasses RLS. This is what makes
--     "never trust the editor's raw output" actually enforceable: a client
--     cannot sanitize-bypass by calling the REST API directly.
--   * Likewise, staff_profiles role changes and invites go through the
--     "staff-users" edge function (service role), not direct table writes,
--     so self-promotion and self-demotion-of-others-only-by-admin rules
--     live in one place.
--   * Everything else (reading posts/categories, staff creating a category,
--     staff deleting their own post) is enforced directly by RLS below.

-- ---------------------------------------------------------------- staff_profiles

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_provider_id uuid unique references auth.users (id) on delete set null,
  email text not null unique,
  display_name text,
  role text not null default 'pending' check (role in ('pending', 'editor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One or more bootstrap-admin emails are always granted admin on first
-- sign-in, so the portal can never lock everyone out. Edit this table in
-- the Supabase SQL editor to add or change who that is.
create table if not exists public.bootstrap_admins (
  email text primary key
);

insert into public.bootstrap_admins (email) values
  ('fowzia@salo.org.za')
on conflict do nothing;

-- ---------------------------------------------------------------- blog_categories

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

insert into public.blog_categories (name, slug) values
  ('Trust Governance', 'trust-governance'),
  ('Implementation', 'implementation'),
  ('Strategic Advisory', 'strategic-advisory'),
  ('Policy & Research', 'policy-research'),
  ('Project Management', 'project-management'),
  ('Company News', 'company-news')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- blog_posts

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  body text not null default '',
  category_id uuid references public.blog_categories (id) on delete set null,
  cover_image_url text,
  images text[] not null default '{}',
  attachments jsonb not null default '[]',
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_published_idx
  on public.blog_posts (status, published_at desc nulls last, created_at desc);
create index if not exists blog_posts_author_idx on public.blog_posts (author_id);
create index if not exists blog_posts_category_idx on public.blog_posts (category_id);

-- ---------------------------------------------------------------- updated_at

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_profiles_set_updated_at on public.staff_profiles;
create trigger staff_profiles_set_updated_at
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- new-user linking

-- Runs after every new auth account. If an admin already invited this email
-- (a staff_profiles row with no auth_provider_id yet), link it. Otherwise
-- create a fresh profile: admin if the email is bootstrapped, pending
-- otherwise.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.staff_profiles
    set auth_provider_id = new.id
    where email = new.email and auth_provider_id is null;

  if not found then
    insert into public.staff_profiles (auth_provider_id, email, display_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', null),
      case
        when exists (select 1 from public.bootstrap_admins b where b.email = new.email) then 'admin'
        else 'pending'
      end
    )
    on conflict (email) do update set auth_provider_id = excluded.auth_provider_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ------------------------------------------------------------------- helpers

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff_profiles where auth_provider_id = auth.uid();
$$;

-- ------------------------------------------------------------------------- RLS

alter table public.staff_profiles enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;

-- staff_profiles: everyone can read their own row; admins can read all.
-- Invites, role changes and removals all go through the staff-users edge
-- function (service role), so there is no insert/update/delete policy here.
drop policy if exists "read own or admin" on public.staff_profiles;
create policy "read own or admin"
  on public.staff_profiles for select
  to authenticated
  using (auth_provider_id = auth.uid() or public.current_staff_role() = 'admin');

-- blog_categories: listing is public; creating requires staff; deleting
-- requires admin (category_id on posts is set null by the FK above).
drop policy if exists "categories are public" on public.blog_categories;
create policy "categories are public"
  on public.blog_categories for select
  to anon, authenticated
  using (true);

drop policy if exists "staff can create categories" on public.blog_categories;
create policy "staff can create categories"
  on public.blog_categories for insert
  to authenticated
  with check (public.current_staff_role() in ('editor', 'admin'));

drop policy if exists "admin can delete categories" on public.blog_categories;
create policy "admin can delete categories"
  on public.blog_categories for delete
  to authenticated
  using (public.current_staff_role() = 'admin');

-- blog_posts: published posts are public; staff can also see their own
-- drafts, admins can see every draft. No insert/update policy — all writes
-- go through the posts-write edge function so the HTML body is always
-- sanitized server-side. Delete follows the same ownership rule as edit.
drop policy if exists "published posts are public" on public.blog_posts;
create policy "published posts are public"
  on public.blog_posts for select
  to anon, authenticated
  using (
    status = 'published'
    or author_id = auth.uid()
    or public.current_staff_role() = 'admin'
  );

drop policy if exists "author or admin can delete" on public.blog_posts;
create policy "author or admin can delete"
  on public.blog_posts for delete
  to authenticated
  using (author_id = auth.uid() or public.current_staff_role() = 'admin');

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;

drop policy if exists "blog media is public to read" on storage.objects;
create policy "blog media is public to read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'blog-media');

drop policy if exists "staff can upload blog media" on storage.objects;
create policy "staff can upload blog media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog-media' and public.current_staff_role() in ('editor', 'admin'));
