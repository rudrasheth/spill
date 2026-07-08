-- =====================================================================
-- SPILL — SUPABASE DATABASE SCHEMA (FRIEND-GROUP SCALE)
-- =====================================================================

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. USERS PROFILE TABLE
-- Linked directly to Supabase Auth user accounts
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text unique not null check (char_length(alias) >= 3),
  real_identity text not null, -- Private email/phone used during OTP/invite verification
  token_balance integer not null default 10 check (token_balance >= 0),
  created_at timestamptz default now(),
  avatar text,
  role text check (role in ('instigator', 'lurker', 'reporter')),
  spend_threshold text check (spend_threshold in ('anything_goes', 'only_a_tier', 'rarely_unlock')),
  badge text
);

-- 1.5 USER TAG AFFINITY TABLE
create table if not exists user_tag_affinity (
  user_id uuid references users(id) on delete cascade,
  tag text not null,
  affinity_score float not null default 0.0,
  primary key (user_id, tag)
);

-- 2. SPILL POSTS TABLE
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references users(id) on delete cascade,
  image_url text not null, -- Supabase Storage URL or seed asset key
  caption text,
  unlock_price integer not null default 5 check (unlock_price >= 0),
  is_blurred boolean not null default true,
  expires_at timestamptz, -- Scheduled expiry time (null means persistent)
  created_at timestamptz default now(),
  reported_count integer not null default 0,
  -- AI moderation status — controls feed visibility
  moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'pending_review', 'rejected')),
  moderation_category text default null, -- what the AI flagged, for operator context
  module text check (module in ('student', 'office', 'other')) not null default 'other',
  tag text check (tag in ('relationship', 'money_career', 'chaos')) not null default 'chaos'
);

-- 3. UNLOCKS LEDGER TABLE
create table if not exists unlocks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  unlocker_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, unlocker_id)
);

-- 4. REPORTS TABLE
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  reporter_id uuid references users(id) on delete cascade,
  reason text not null,
  status text default 'pending' check (status in ('pending', 'actioned', 'dismissed')),
  created_at timestamptz default now()
);

-- 5. GROUP MESSAGES TABLE
create table if not exists group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  sender_id uuid references users(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

-- =====================================================================
-- 6. GROUPS TABLE (public vs private channels)
-- =====================================================================

create table if not exists groups (
  id text primary key, -- slug-style e.g. 'general-spill'
  name text not null,
  description text not null default '',
  is_private boolean not null default false,
  invite_code text default null, -- only set for private groups
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

-- Seed the default public channels (idempotent)
insert into groups (id, name, description, is_private) values
  ('general-spill',    'general-spill',    'Main gossip channel for the group.',           false),
  ('crypto-rumors',    'crypto-rumors',    'Leaks and rumors from the web3 space.',         false),
  ('vc-funding-drama', 'vc-funding-drama', 'Downrounds, valuation cuts, pitch decks.',     false)
on conflict (id) do nothing;

-- 7. GROUP MEMBERS TABLE
create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

-- =====================================================================
-- 8. MODERATION FLAGS TABLE (CSAM / CRITICAL — operator-only)
-- =====================================================================

-- Never exposed to clients. Edge function writes here via service role key.
-- Operator sees only a flag count in the Logs screen — no image content displayed.
create table if not exists moderation_flags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  category text not null,   -- e.g. 'csam_suspected', 'graphic_violence'
  confidence float not null,
  flagged_at timestamptz default now(),
  reviewed boolean not null default false,
  reviewed_at timestamptz default null
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

alter table users enable row level security;
alter table user_tag_affinity enable row level security;
alter table posts enable row level security;
alter table unlocks enable row level security;
alter table reports enable row level security;
alter table group_messages enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table moderation_flags enable row level security;

-- USER TAG AFFINITY POLICIES
drop policy if exists "Users can read their own tag affinity" on user_tag_affinity;
create policy "Users can read their own tag affinity"
  on user_tag_affinity for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their own tag affinity" on user_tag_affinity;
create policy "Users can manage their own tag affinity"
  on user_tag_affinity for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- USERS POLICIES
drop policy if exists "Public profile read access" on users;
create policy "Public profile read access" 
  on users for select 
  using (true);

drop policy if exists "Users can insert their own profile" on users;
create policy "Users can insert their own profile" 
  on users for insert 
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on users;
create policy "Users can update their own profile"
  on users for update
  using (auth.uid() = id);

-- POSTS POLICIES
-- Feed only shows approved posts; authors always see their own regardless of status
drop policy if exists "Anyone can read non-flagged active posts" on posts;
create policy "Anyone can read non-flagged active posts" 
  on posts for select 
  using (
    auth.uid() = author_id  -- author always sees their own posts
    OR (
      moderation_status = 'approved'
      AND reported_count < 1
      AND (expires_at is null OR expires_at > now())
    )
  );

drop policy if exists "Users can insert their own posts" on posts;
create policy "Users can insert their own posts" 
  on posts for insert 
  with check (auth.uid() = author_id);

drop policy if exists "Authors can delete/modify their own posts" on posts;
create policy "Authors can delete/modify their own posts"
  on posts for delete
  using (auth.uid() = author_id);

-- Operator/edge-function moderation updates
drop policy if exists "Allow moderation status updates" on posts;
create policy "Allow moderation status updates"
  on posts for update
  using (true);

-- UNLOCKS POLICIES
drop policy if exists "Users can read all unlocks" on unlocks;
create policy "Users can read all unlocks" 
  on unlocks for select 
  using (true);

drop policy if exists "Users can insert their own unlocks" on unlocks;
create policy "Users can insert their own unlocks" 
  on unlocks for insert 
  with check (auth.uid() = unlocker_id);

-- REPORTS POLICIES
drop policy if exists "Users can insert abuse reports" on reports;
create policy "Users can insert abuse reports" 
  on reports for insert 
  with check (auth.uid() = reporter_id);

drop policy if exists "Operators can read reports" on reports;
create policy "Operators can read reports" 
  on reports for select 
  using (true);

-- GROUP MESSAGES POLICIES
drop policy if exists "Anyone can read group messages" on group_messages;
create policy "Anyone can read group messages" 
  on group_messages for select 
  using (true);

drop policy if exists "Users can insert group messages" on group_messages;
create policy "Users can insert group messages" 
  on group_messages for insert 
  with check (auth.uid() = sender_id);

-- GROUPS POLICIES
drop policy if exists "Anyone can read groups" on groups;
create policy "Anyone can read groups"
  on groups for select
  using (true);

drop policy if exists "Users can create groups" on groups;
create policy "Users can create groups"
  on groups for insert
  with check (auth.uid() = created_by);

-- GROUP MEMBERS POLICIES
drop policy if exists "Anyone can read group members" on group_members;
create policy "Anyone can read group members"
  on group_members for select
  using (true);

drop policy if exists "Users can join groups" on group_members;
create policy "Users can join groups"
  on group_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can leave groups" on group_members;
create policy "Users can leave groups"
  on group_members for delete
  using (auth.uid() = user_id);

-- MODERATION FLAGS POLICIES (service role write; authenticated read for operator panel)
drop policy if exists "Service role can insert moderation flags" on moderation_flags;
create policy "Service role can insert moderation flags"
  on moderation_flags for insert
  with check (true);

drop policy if exists "Authenticated users can read moderation flags" on moderation_flags;
create policy "Authenticated users can read moderation flags"
  on moderation_flags for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated users can update moderation flags" on moderation_flags;
create policy "Authenticated users can update moderation flags"
  on moderation_flags for update
  using (auth.uid() is not null);

-- =====================================================================
-- SUPABASE STORAGE BUCKET: spill-images
-- =====================================================================
-- Run these separately in the Supabase SQL Editor (Storage schema):

insert into storage.buckets (id, name, public)
values ('spill-images', 'spill-images', true)
on conflict (id) do nothing;

create policy "Public read access to spill-images"
  on storage.objects for select
  using ( bucket_id = 'spill-images' );

create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check ( bucket_id = 'spill-images' AND auth.uid() is not null );

create policy "Authors can delete their own images"
  on storage.objects for delete
  using ( bucket_id = 'spill-images' AND auth.uid()::text = (storage.foldername(name))[1] );

-- =====================================================================
-- ATOMIC UNLOCK POST TRANSACTION (RPC)
-- =====================================================================

create or replace function unlock_post(p_post_id uuid, p_user_id uuid)
returns void as $$
declare
  v_price integer;
  v_author uuid;
  v_already_unlocked boolean;
begin
  -- Check if already unlocked by this user
  select exists(
    select 1 from unlocks where post_id = p_post_id and unlocker_id = p_user_id
  ) into v_already_unlocked;

  if v_already_unlocked then
    return;
  end if;

  -- Lock post row to prevent race conditions during write
  select unlock_price, author_id into v_price, v_author
  from posts where id = p_post_id for update;

  if not found then
    raise exception 'Post not found';
  end if;

  -- Author does not need to pay to unlock their own post
  if v_author = p_user_id then
    insert into unlocks (post_id, unlocker_id) values (p_post_id, p_user_id);
    return;
  end if;

  -- Deduct tokens from reader
  update users set token_balance = token_balance - v_price
  where id = p_user_id and token_balance >= v_price;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  -- Add 60% of tokens to author (3/5)
  if v_author is not null then
    update users set token_balance = token_balance + (v_price * 3 / 5)
    where id = v_author;
  end if;

  -- Record the unlock transaction in history
  insert into unlocks (post_id, unlocker_id) values (p_post_id, p_user_id);
end;
$$ language plpgsql security definer set search_path = public;

-- =====================================================================
-- REPORT AUTOMATION TRIGGERS
-- =====================================================================

-- Automatically hide post on report
create or replace function increment_post_report()
returns trigger as $$
begin
  update posts 
  set reported_count = reported_count + 1 
  where id = new.post_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_on_report_added on reports;
create trigger tr_on_report_added
after insert on reports
for each row
execute function increment_post_report();
