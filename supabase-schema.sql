-- Noble West Social Review Tool — Supabase SQL Schema
-- Run this SQL in your Supabase project via: SQL Editor > New Query > Paste > Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Organizations (Noble West itself + extensible for future multi-agency)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Insert Noble West as the default org
insert into organizations (name) values ('Noble West');

-- Workspaces (one per client/partner)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  magic_link_token uuid not null unique default gen_random_uuid(),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'nw_team' check (role in ('nw_admin', 'nw_team')),
  notification_pref text not null default 'immediate' check (notification_pref in ('immediate', 'digest', 'off')),
  digest_time time not null default '08:00:00',
  created_at timestamptz not null default now()
);

-- Workspace membership (NW team members assigned to workspaces)
create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Monthly calendars
create table calendars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2020),
  created_at timestamptz not null default now(),
  unique (workspace_id, month, year)
);

-- Posts
create table posts (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars(id) on delete cascade,
  title text not null default 'New Post',
  proposed_date date not null,
  platforms text[] not null default '{}',
  copy text not null default '',
  assets jsonb not null default '[]'::jsonb, -- multi-image/gif carousel
  asset_url text, -- legacy/video
  asset_type text check (asset_type in ('image', 'gif', 'video_link')),
  notes text,           -- internal only
  usage_rights text,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'needs_revision', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

-- Post change log
create table post_change_log (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid references profiles(id),
  user_name text,
  note text not null,
  created_at timestamptz not null default now()
);

-- Comments (both internal and client threads)
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid references profiles(id),     -- null = magic-link client
  author_name text,
  body text not null,
  thread text not null check (thread in ('internal', 'client')),
  is_resolved boolean not null default false,
  parent_id uuid references comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- @mention queue for notifications
create table mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  mentioned_email text not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── Auto-create profile on signup ──────────────────────────────────────────

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table organizations enable row level security;
alter table workspaces enable row level security;
alter table profiles enable row level security;
alter table workspace_members enable row level security;
alter table calendars enable row level security;
alter table posts enable row level security;
alter table post_change_log enable row level security;
alter table comments enable row level security;
alter table mentions enable row level security;

-- Helper: is current user an NW admin?
create or replace function is_nw_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'nw_admin'
  );
$$ language sql security definer stable;

-- Helper: is current user a NW team member with access to a workspace?
create or replace function has_workspace_access(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'nw_admin'
  ) or exists (
    select 1 from workspace_members where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Organizations: admins only
create policy "Admins read orgs" on organizations for select using (is_nw_admin());

-- Workspaces
create policy "Team reads assigned workspaces" on workspaces for select
  using (has_workspace_access(id));
create policy "Admins full workspaces" on workspaces for all
  using (is_nw_admin()) with check (is_nw_admin());

-- Profiles: read own + admins see all
create policy "Read own profile" on profiles for select using (auth.uid() = id);
create policy "Admins read all profiles" on profiles for select using (is_nw_admin());
create policy "Update own profile" on profiles for update using (auth.uid() = id);

-- Workspace members
create policy "Admins manage members" on workspace_members for all
  using (is_nw_admin()) with check (is_nw_admin());
create policy "Team reads own memberships" on workspace_members for select
  using (user_id = auth.uid());

-- Calendars: team members with access to workspace
create policy "Team reads calendars" on calendars for select
  using (has_workspace_access(workspace_id));
create policy "Team inserts calendars" on calendars for insert
  with check (has_workspace_access(workspace_id));

-- Posts
create policy "Team reads posts" on posts for select
  using (exists (select 1 from calendars c where c.id = calendar_id and has_workspace_access(c.workspace_id)));
create policy "Team inserts posts" on posts for insert
  with check (exists (select 1 from calendars c where c.id = calendar_id and has_workspace_access(c.workspace_id)));
create policy "Team updates posts" on posts for update
  using (exists (select 1 from calendars c where c.id = calendar_id and has_workspace_access(c.workspace_id)));
create policy "Admins delete posts" on posts for delete using (is_nw_admin());

-- Change log
create policy "Team reads change log" on post_change_log for select
  using (exists (select 1 from posts p join calendars c on c.id = p.calendar_id where p.id = post_id and has_workspace_access(c.workspace_id)));
create policy "Team inserts change log" on post_change_log for insert
  with check (exists (select 1 from posts p join calendars c on c.id = p.calendar_id where p.id = post_id and has_workspace_access(c.workspace_id)));

-- Comments: team reads all; client thread readable by anyone authenticated or anon via service role
create policy "Team reads internal comments" on comments for select
  using (
    thread = 'internal' and
    exists (select 1 from posts p join calendars c on c.id = p.calendar_id where p.id = post_id and has_workspace_access(c.workspace_id))
  );
create policy "Team reads client comments" on comments for select
  using (
    thread = 'client' and
    exists (select 1 from posts p join calendars c on c.id = p.calendar_id where p.id = post_id and has_workspace_access(c.workspace_id))
  );
create policy "Team inserts comments" on comments for insert
  with check (exists (select 1 from posts p join calendars c on c.id = p.calendar_id where p.id = post_id and has_workspace_access(c.workspace_id)));
create policy "Team updates comments" on comments for update
  using (exists (select 1 from posts p join calendars c on c.id = p.calendar_id where p.id = post_id and has_workspace_access(c.workspace_id)));
create policy "Team deletes comments" on comments for delete
  using (exists (select 1 from posts p join calendars c on c.id = p.calendar_id where p.id = post_id and has_workspace_access(c.workspace_id)));

-- ─── Client (magic link) access via anon key ─────────────────────────────────
-- Client portal uses the anon key. We grant READ on specific tables for anon.
-- The client portal JS queries workspace by magic_link_token — no auth.uid() available.

-- Allow anon to look up a workspace by magic link token (for client portal)
create policy "Anon reads workspace by token" on workspaces for select
  to anon using (true);

-- Allow anon to read calendars and posts in non-archived workspaces
create policy "Anon reads calendars" on calendars for select to anon using (true);
create policy "Anon reads posts" on posts for select to anon using (true);

-- Allow anon to insert client comments
create policy "Anon inserts client comments" on comments for insert
  to anon with check (thread = 'client');

-- Allow anon to read client comments (NOT internal)
create policy "Anon reads client comments" on comments for select
  to anon using (thread = 'client');

-- Allow anon to update post status (approved / needs_revision) for client portal
create policy "Anon updates post status" on posts for update
  to anon using (true) with check (status in ('approved', 'needs_revision'));

-- ─── Storage Bucket ──────────────────────────────────────────────────────────
-- Run this in Supabase Dashboard > Storage > New Bucket
-- Bucket name: post-assets
-- Public: true
-- File size limit: 20971520 (20MB)
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- IMPORTANT: You must enable these Storage RLS policies for the team to upload files
create policy "Team can upload post assets" on storage.objects for insert to authenticated with check ( bucket_id = 'post-assets' );
create policy "Team can update post assets" on storage.objects for update to authenticated with check ( bucket_id = 'post-assets' );
create policy "Team can delete post assets" on storage.objects for delete to authenticated using ( bucket_id = 'post-assets' );
create policy "Public can read post assets" on storage.objects for select to public using ( bucket_id = 'post-assets' );

-- ─── IMPORTANT: First NW Admin ───────────────────────────────────────────────
-- After your first Google login, run this to make yourself admin:
-- UPDATE profiles SET role = 'nw_admin' WHERE email = 'your-email@yourdomain.com';
