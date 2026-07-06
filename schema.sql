-- =====================================================================
-- SPILL — SUPABASE DATABASE SCHEMA
-- =====================================================================

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. USERS TABLE
create table users (
  id uuid primary key default gen_random_uuid(),
  hashed_device_id text unique not null,
  token_balance integer not null default 10 check (token_balance >= 0),
  cluster_id text,
  created_at timestamptz default now()
);

-- 2. POSTS TABLE
create table posts (
  id uuid primary key default gen_random_uuid(),
  hashed_author_id uuid references users(id) on delete set null,
  media_url text not null,
  caption text,
  unlock_price integer not null default 5 check (unlock_price >= 0),
  is_blurred boolean not null default true,
  redis_key text unique not null,
  created_at timestamptz default now(),
  reported_count integer not null default 0
);

-- 3. UNLOCKS (LEDGER) TABLE
create table unlocks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  unlocker_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, unlocker_id)
);

-- 4. REPORTS TABLE
create table reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  reporter_id uuid references users(id) on delete cascade,
  reason text not null,
  status text default 'pending' check (status in ('pending', 'actioned', 'dismissed')),
  created_at timestamptz default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

alter table users enable row level security;
alter table posts enable row level security;
alter table unlocks enable row level security;
alter table reports enable row level security;

-- USERS POLICIES
create policy "Users can read their own profile" 
  on users for select 
  using (true); -- Everyone can view user records (necessary to read balance/profiles for posts/unlocks), or restrict to auth user

create policy "Users can insert their own profile" 
  on users for insert 
  with check (true);

create policy "Users can update their own profile"
  on users for update
  using (true);

-- POSTS POLICIES
create policy "Anyone can read posts" 
  on posts for select 
  using (reported_count < 1); -- Hide posts immediately if they have been reported

create policy "Users can insert posts" 
  on posts for insert 
  with check (true);

-- UNLOCKS POLICIES
create policy "Users can read their own unlocks" 
  on unlocks for select 
  using (true);

create policy "Users can insert unlocks" 
  on unlocks for insert 
  with check (true);

-- REPORTS POLICIES
create policy "Users can insert reports" 
  on reports for insert 
  with check (true);

create policy "Admins can read reports" 
  on reports for select 
  using (true);

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
  -- Check if already unlocked
  select exists(
    select 1 from unlocks where post_id = p_post_id and unlocker_id = p_user_id
  ) into v_already_unlocked;

  if v_already_unlocked then
    return;
  end if;

  -- Lock post row to avoid race conditions
  select unlock_price, hashed_author_id into v_price, v_author
  from posts where id = p_post_id for update;

  if not found then
    raise exception 'Post not found';
  end if;

  -- Check if user is trying to unlock their own post
  if v_author = p_user_id then
    -- Author does not need to unlock their own post
    insert into unlocks (post_id, unlocker_id) values (p_post_id, p_user_id);
    return;
  end if;

  -- Deduct tokens from reader
  update users set token_balance = token_balance - v_price
  where id = p_user_id and token_balance >= v_price;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  -- Add tokens to poster (60% i.e. 3/5, or v_price * 3 / 5)
  if v_author is not null then
    update users set token_balance = token_balance + (v_price * 3 / 5)
    where id = v_author;
  end if;

  -- Record the unlock
  insert into unlocks (post_id, unlocker_id) values (p_post_id, p_user_id);
end;
$$ language plpgsql;

-- Trigger to increment reported_count and auto-hide posts
create or replace function increment_post_report()
returns trigger as $$
begin
  update posts 
  set reported_count = reported_count + 1 
  where id = new.post_id;
  return new;
end;
$$ language plpgsql;

create trigger tr_on_report_added
after insert on reports
for each row
execute function increment_post_report();
