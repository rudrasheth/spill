-- =====================================================================
-- SPILL — SUPABASE DATABASE UPDATE & MIGRATION SCRIPT
-- Run this in the Supabase SQL Editor
-- =====================================================================

-- 1. ADD NEW COLUMNS TO posts TABLE
alter table posts add column if not exists unlock_count integer not null default 0;
alter table posts add column if not exists view_count integer not null default 0;

-- 2. CREATE BOUNTIES TABLES
create table if not exists bounties (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references users(id) on delete cascade,
  module text check (module in ('student','office','other')) not null default 'other',
  description text not null,
  pool_total integer not null default 0 check (pool_total >= 0),
  status text not null default 'open' check (status in ('open', 'claimed', 'expired')),
  claimed_by_post_id uuid references posts(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

alter table posts add column if not exists bounty_id uuid references bounties(id) on delete set null;

create table if not exists bounty_contributions (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid references bounties(id) on delete cascade,
  contributor_id uuid references users(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz default now()
);

-- Enable RLS
alter table bounties enable row level security;
alter table bounty_contributions enable row level security;

-- Policies for bounties
drop policy if exists "Anyone can read bounties" on bounties;
create policy "Anyone can read bounties" on bounties
  for select using (true);

drop policy if exists "Authenticated users can create bounties" on bounties;
create policy "Authenticated users can create bounties" on bounties
  for insert with check (auth.uid() = requester_id);

drop policy if exists "Bounty requester or edge function can update bounties" on bounties;
create policy "Bounty requester or edge function can update bounties" on bounties
  for update using (true);

-- Policies for bounty contributions
drop policy if exists "Anyone can read bounty contributions" on bounty_contributions;
create policy "Anyone can read bounty contributions" on bounty_contributions
  for select using (true);

drop policy if exists "Authenticated users can contribute to bounties" on bounty_contributions;
create policy "Authenticated users can contribute to bounties" on bounty_contributions
  for insert with check (auth.uid() = contributor_id);

-- =====================================================================
-- 3. RECREATE / UPDATE ATOMIC UNLOCK POST TRANSACTION (RPC)
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

  -- Increment post unlock count
  update posts set unlock_count = coalesce(unlock_count, 0) + 1 where id = p_post_id;

  -- Record the unlock transaction in history
  insert into unlocks (post_id, unlocker_id) values (p_post_id, p_user_id);
end;
$$ language plpgsql security definer set search_path = public;

-- =====================================================================
-- 4. VIEW COUNT INCREMENT RPC
-- =====================================================================
create or replace function increment_post_views(p_post_ids uuid[])
returns void as $$
begin
  update posts
  set view_count = coalesce(view_count, 0) + 1
  where id = any(p_post_ids);
end;
$$ language plpgsql security definer set search_path = public;

-- =====================================================================
-- 5. "WORTH IT" PREDICTIVE ALGORITHM RPC
-- =====================================================================
create or replace function get_post_worth_it_score(p_post_id uuid)
returns table (
  score float,
  tier text,
  reason text
) as $$
declare
  v_author_id uuid;
  v_module text;
  v_tag text;
  v_price int;
  v_created_at timestamptz;
  v_unlock_count int;
  v_view_count int;
  
  -- components
  v_poster_avg_unlock_rate float;
  v_early_velocity_vs_typical float;
  v_price_relative_to_module_avg float;
  v_module_tag_historical_hit_rate float;
  
  v_typical_early_unlocks float;
  v_module_avg_price float;
  v_post_early_unlocks float;
  
  v_final_score float;
  v_tier text;
  v_reason text;
  v_author_post_count int;
begin
  -- Get post details
  select author_id, module, tag, unlock_price, created_at, unlock_count, view_count
  into v_author_id, v_module, v_tag, v_price, v_created_at, v_unlock_count, v_view_count
  from posts where id = p_post_id;
  
  if not found then
    return query select 0.0::float, 'unknown'::text, 'Post not found'::text;
    return;
  end if;

  -- Post count of author to establish history
  select count(*) into v_author_post_count from posts where author_id = v_author_id;

  -- 1. poster_avg_unlock_rate
  select coalesce(avg(unlock_count::float / nullif(view_count, 0)), 0.0)
  into v_poster_avg_unlock_rate
  from posts
  where author_id = v_author_id and id <> p_post_id;

  -- 2. typical early unlocks (avg unlocks in first 30 mins for other posts)
  select coalesce(avg(early_cnt), 1.0)
  into v_typical_early_unlocks
  from (
    select count(*)::float as early_cnt
    from posts po
    join unlocks u on u.post_id = po.id
    where po.id <> p_post_id 
      and u.created_at <= po.created_at + interval '30 minutes'
    group by po.id
  ) s;
  
  -- post early unlocks
  select count(*)::float
  into v_post_early_unlocks
  from unlocks
  where post_id = p_post_id and created_at <= v_created_at + interval '30 minutes';
  
  v_early_velocity_vs_typical := coalesce(v_post_early_unlocks / nullif(v_typical_early_unlocks, 0.0), 0.0);
  if v_early_velocity_vs_typical > 2.0 then
    v_early_velocity_vs_typical := 2.0;
  end if;

  -- 3. price relative to module average
  select coalesce(avg(unlock_price), 3.0)
  into v_module_avg_price
  from posts
  where module = v_module;
  
  v_price_relative_to_module_avg := coalesce(v_module_avg_price / nullif(v_price, 0), 1.0);
  if v_price_relative_to_module_avg > 2.0 then
    v_price_relative_to_module_avg := 2.0;
  end if;

  -- 4. module/tag historical hit rate
  select coalesce(avg(unlock_count::float / nullif(view_count, 0)), 0.0)
  into v_module_tag_historical_hit_rate
  from posts
  where module = v_module and tag = v_tag and id <> p_post_id;

  -- Weighted Score calculation
  v_final_score := (v_poster_avg_unlock_rate * 0.4)
                 + (v_early_velocity_vs_typical * 0.3)
                 + (v_price_relative_to_module_avg * 0.15)
                 + (v_module_tag_historical_hit_rate * 0.15);

  -- Determine tier
  if v_author_post_count <= 1 then
    v_tier := 'unknown';
    v_reason := 'New poster — no history yet';
    v_final_score := 0.0;
  elsif v_final_score > 0.7 then
    v_tier := 'high';
    v_reason := 'This poster''s last posts were unlocked by ' || round(coalesce(v_poster_avg_unlock_rate, 0.0) * 100) || '% of viewers';
  elsif v_final_score >= 0.4 then
    v_tier := 'mixed';
    v_reason := 'Mixed velocity and price alignment';
  else
    v_tier := 'low';
    v_reason := 'Historically low unlock rates';
  end if;

  return query select v_final_score, v_tier, v_reason;
end;
$$ language plpgsql security definer set search_path = public;

-- =====================================================================
-- 6. FEED PERSONALIZATION SCORING RPC
-- =====================================================================
create or replace function get_personalized_feed(p_user_id uuid)
returns table (
  id uuid,
  author_id uuid,
  image_url text,
  caption text,
  unlock_price int,
  is_blurred boolean,
  moderation_status text,
  moderation_category text,
  module text,
  tag text,
  view_count int,
  unlock_count int,
  expires_at timestamptz,
  created_at timestamptz,
  bounty_id uuid,
  personalization_score float,
  worth_it_tier text,
  worth_it_reason text
) as $$
begin
  return query
  select 
    p.id,
    p.author_id,
    p.image_url,
    p.caption,
    p.unlock_price,
    p.is_blurred,
    p.moderation_status,
    p.moderation_category,
    p.module,
    p.tag,
    p.view_count,
    p.unlock_count,
    p.expires_at,
    p.created_at,
    p.bounty_id,
    (
      -- tag affinities (affinity for tag and module)
      coalesce((select affinity_score from user_tag_affinity where user_id = p_user_id and tag = p.tag), 1.0) +
      coalesce((select affinity_score from user_tag_affinity where user_id = p_user_id and tag = p.module), 1.0)
    ) * 2.0
    + (100.0 / greatest(extract(epoch from (now() - p.created_at)) / 3600.0, 0.1))
    + (5.0 * coalesce(p.unlock_count, 0))
    as personalization_score,
    w.tier as worth_it_tier,
    w.reason as worth_it_reason
  from posts p
  cross join lateral get_post_worth_it_score(p.id) w
  where 
    p.author_id = p_user_id
    or (
      p.moderation_status = 'approved'
      and p.reported_count < 1
      and (p.expires_at is null or p.expires_at > now())
    );
end;
$$ language plpgsql security definer set search_path = public;

-- =====================================================================
-- 7. ATOMIC BOUNTY OPERATIONS RPCs
-- =====================================================================

-- Create a Bounty
create or replace function create_bounty(
  p_requester_id uuid,
  p_module text,
  p_description text,
  p_pledge int,
  p_expires_in_hours int
) returns uuid as $$
declare
  v_bounty_id uuid;
begin
  -- check balance
  if not exists (select 1 from users where id = p_requester_id and token_balance >= p_pledge) then
    raise exception 'insufficient balance for pledge';
  end if;
  
  -- deduct tokens
  update users set token_balance = token_balance - p_pledge where id = p_requester_id;
  
  -- insert bounty
  insert into bounties (requester_id, module, description, pool_total, status, expires_at)
  values (p_requester_id, p_module, p_description, p_pledge, 'open', now() + (p_expires_in_hours * interval '1 hour'))
  returning id into v_bounty_id;
  
  -- record contribution
  insert into bounty_contributions (bounty_id, contributor_id, amount)
  values (v_bounty_id, p_requester_id, p_pledge);
  
  return v_bounty_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Contribute to a Bounty
create or replace function contribute_to_bounty(
  p_bounty_id uuid,
  p_contributor_id uuid,
  p_amount int
) returns void as $$
declare
  v_status text;
  v_expires_at timestamptz;
begin
  select status, expires_at into v_status, v_expires_at from bounties where id = p_bounty_id;
  if v_status <> 'open' or v_expires_at <= now() then
    raise exception 'bounty is closed or expired';
  end if;
  
  -- check balance
  if not exists (select 1 from users where id = p_contributor_id and token_balance >= p_amount) then
    raise exception 'insufficient balance to contribute';
  end if;
  
  -- deduct tokens
  update users set token_balance = token_balance - p_amount where id = p_contributor_id;
  
  -- insert contribution
  insert into bounty_contributions (bounty_id, contributor_id, amount)
  values (p_bounty_id, p_contributor_id, p_amount);
  
  -- update pool total
  update bounties set pool_total = pool_total + p_amount where id = p_bounty_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Claim a Bounty
create or replace function claim_bounty(
  p_bounty_id uuid,
  p_post_id uuid,
  p_creator_id uuid
) returns void as $$
declare
  v_status text;
  v_requester uuid;
  v_pool int;
  v_author uuid;
begin
  select status, requester_id, pool_total into v_status, v_requester, v_pool
  from bounties where id = p_bounty_id for update;
  
  if v_status <> 'open' then
    raise exception 'bounty is not open';
  end if;
  
  if v_requester <> p_creator_id then
    raise exception 'only the bounty creator can approve and claim';
  end if;
  
  select author_id into v_author from posts where id = p_post_id;
  if not found then
    raise exception 'fulfilling post not found';
  end if;
  
  -- Transfer 60% of bounty pool to post author
  if v_author is not null and v_pool > 0 then
    update users set token_balance = token_balance + round(v_pool * 0.6)
    where id = v_author;
  end if;
  
  -- Mark bounty as claimed
  update bounties
  set status = 'claimed',
      claimed_by_post_id = p_post_id
  where id = p_bounty_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Expire & Refund Expired Bounties
create or replace function refund_expired_bounties()
returns void as $$
declare
  v_bounty record;
  v_contrib record;
begin
  for v_bounty in 
    select id from bounties where status = 'open' and expires_at <= now() for update
  loop
    -- refund each contribution
    for v_contrib in 
      select contributor_id, amount from bounty_contributions where bounty_id = v_bounty.id
    loop
      update users
      set token_balance = token_balance + v_contrib.amount
      where id = v_contrib.contributor_id;
    end loop;
    
    -- mark bounty as expired
    update bounties set status = 'expired' where id = v_bounty.id;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;
