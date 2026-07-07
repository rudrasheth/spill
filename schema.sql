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
  created_at timestamptz default now()
);

-- 2. SPILL POSTS TABLE
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references users(id) on delete cascade,
  image_url text not null, -- Storage path or base64 data URI
  caption text,
  unlock_price integer not null default 5 check (unlock_price >= 0),
  is_blurred boolean not null default true,
  expires_at timestamptz, -- Scheduled expiry time (null means persistent)
  created_at timestamptz default now(),
  reported_count integer not null default 0
);

-- 3. UNLOCKS LEDGER TABLE
-- Tracks which user unlocked which post
create table if not exists unlocks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  unlocker_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, unlocker_id)
);

-- 4. REPORTS TABLE
-- Tracks flags on posts; automatically increments reported_count
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  reporter_id uuid references users(id) on delete cascade,
  reason text not null,
  status text default 'pending' check (status in ('pending', 'actioned', 'dismissed')),
  created_at timestamptz default now()
);

-- 5. GROUP MESSAGES TABLE
-- Retained server-side for 24-48h for moderation, but UI only queries recent messages
create table if not exists group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  sender_id uuid references users(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

alter table users enable row level security;
alter table posts enable row level security;
alter table unlocks enable row level security;
alter table reports enable row level security;
alter table group_messages enable row level security;

-- USERS POLICIES
drop policy if exists "Public profile read access" on users;
create policy "Public profile read access" 
  on users for select 
  using (true); -- Required to map aliases and show balances for other feed/post authors

drop policy if exists "Users can insert their own profile" on users;
create policy "Users can insert their own profile" 
  on users for insert 
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on users;
create policy "Users can update their own profile"
  on users for update
  using (auth.uid() = id);

-- POSTS POLICIES
drop policy if exists "Anyone can read non-flagged active posts" on posts;
create policy "Anyone can read non-flagged active posts" 
  on posts for select 
  using (reported_count < 1 and (expires_at is null or expires_at > now()));

drop policy if exists "Users can insert their own posts" on posts;
create policy "Users can insert their own posts" 
  on posts for insert 
  with check (auth.uid() = author_id);

drop policy if exists "Authors can delete/modify their own posts" on posts;
create policy "Authors can delete/modify their own posts"
  on posts for delete
  using (auth.uid() = author_id);

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
  using (true); -- Restrict to admin roles in real production if needed

-- GROUP MESSAGES POLICIES
drop policy if exists "Anyone can read group messages" on group_messages;
create policy "Anyone can read group messages" 
  on group_messages for select 
  using (true);

drop policy if exists "Users can insert group messages" on group_messages;
create policy "Users can insert group messages" 
  on group_messages for insert 
  with check (auth.uid() = sender_id);

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
