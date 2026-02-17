-- ============================================================
-- QuitBite / Undelivery — Full per-account schema
-- Run this against your Supabase project (SQL Editor or CLI).
-- ============================================================

-- ── 1. profiles ─────────────────────────────────────────────
-- Core user profile. One row per auth.users entry.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text,
  email         text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ── 2. onboarding ───────────────────────────────────────────
-- Stores quiz answers and onboarding-collected data.
-- Kept separate from profiles so onboarding can be re-run.
create table if not exists public.onboarding (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  quiz_answers      jsonb default '{}'::jsonb,
  affirmation       text,
  notification_prefs jsonb default '{"budget_reminders": true, "cooking_ideas": true}'::jsonb,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.onboarding enable row level security;

create policy "Users can read own onboarding"
  on public.onboarding for select using (auth.uid() = user_id);
create policy "Users can upsert own onboarding"
  on public.onboarding for insert with check (auth.uid() = user_id);
create policy "Users can update own onboarding"
  on public.onboarding for update using (auth.uid() = user_id);

-- ── 3. budgets ──────────────────────────────────────────────
-- Weekly budget settings. One active row per user.
create table if not exists public.budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  weekly_limit    numeric(10,2) not null default 120.00,
  reset_day       smallint not null default 1,  -- 0=Sun, 1=Mon, …6=Sat
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id)
);

alter table public.budgets enable row level security;

create policy "Users can read own budget"
  on public.budgets for select using (auth.uid() = user_id);
create policy "Users can insert own budget"
  on public.budgets for insert with check (auth.uid() = user_id);
create policy "Users can update own budget"
  on public.budgets for update using (auth.uid() = user_id);

-- ── 4. orders ───────────────────────────────────────────────
-- Every delivery order the user logs (manual or imported).
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  vendor          text not null,
  amount          numeric(10,2) not null,
  ordered_at      timestamptz not null default now(),
  notes           text,
  source          text not null default 'manual',  -- 'manual' | 'import'
  created_at      timestamptz not null default now()
);

create index if not exists idx_orders_user_date on public.orders (user_id, ordered_at desc);

alter table public.orders enable row level security;

create policy "Users can read own orders"
  on public.orders for select using (auth.uid() = user_id);
create policy "Users can insert own orders"
  on public.orders for insert with check (auth.uid() = user_id);
create policy "Users can update own orders"
  on public.orders for update using (auth.uid() = user_id);
create policy "Users can delete own orders"
  on public.orders for delete using (auth.uid() = user_id);

-- ── 5. blocking_settings ────────────────────────────────────
-- Per-account app-blocking configuration.
create table if not exists public.blocking_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  enabled             boolean not null default false,
  soft_block_enabled  boolean not null default false,
  mode                text not null default 'flexible' check (mode in ('flexible', 'strict')),
  cooldown_minutes    smallint not null default 7,
  penalty_enabled     boolean not null default false,
  penalty_amount      numeric(10,2) not null default 5.00,
  selected_app_count  smallint not null default 0,
  schedule_enabled    boolean not null default false,
  schedule_start_hour smallint not null default 11,
  schedule_start_min  smallint not null default 0,
  schedule_end_hour   smallint not null default 14,
  schedule_end_min    smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.blocking_settings enable row level security;

create policy "Users can read own blocking settings"
  on public.blocking_settings for select using (auth.uid() = user_id);
create policy "Users can insert own blocking settings"
  on public.blocking_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own blocking settings"
  on public.blocking_settings for update using (auth.uid() = user_id);

-- ── 6. block_events ─────────────────────────────────────────
-- Audit log of every block trigger, override, and unblock.
create table if not exists public.block_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  event_type      text not null check (event_type in ('hard_block', 'soft_block', 'override', 'unblock', 'schedule_block', 'schedule_unblock')),
  block_mode      text,  -- 'flexible' | 'strict' at time of event
  penalty_amount  numeric(10,2),
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_block_events_user on public.block_events (user_id, created_at desc);

alter table public.block_events enable row level security;

create policy "Users can read own block events"
  on public.block_events for select using (auth.uid() = user_id);
create policy "Users can insert own block events"
  on public.block_events for insert with check (auth.uid() = user_id);

-- ── 7. subscriptions ────────────────────────────────────────
-- RevenueCat subscription state per user (already partially exists).
create table if not exists public.subscriptions (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  rc_customer_id        text,
  rc_app_user_id        text,
  rc_entitlement_active boolean not null default false,
  rc_entitlement_id     text,
  rc_product_id         text,
  rc_subscription_name  text,
  rc_subscription_price text,
  rc_last_event_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);
create policy "Users can upsert own subscription"
  on public.subscriptions for insert with check (auth.uid() = user_id);
create policy "Users can update own subscription"
  on public.subscriptions for update using (auth.uid() = user_id);

-- ── 8. weekly_stats ─────────────────────────────────────────
-- Aggregated weekly snapshot for streaks, reports, trends.
create table if not exists public.weekly_stats (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  week_start      date not null,
  total_spend     numeric(10,2) not null default 0,
  order_count     smallint not null default 0,
  budget_limit    numeric(10,2),
  overrides_used  smallint not null default 0,
  penalty_total   numeric(10,2) not null default 0,
  streak_days     smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists idx_weekly_stats_user on public.weekly_stats (user_id, week_start desc);

alter table public.weekly_stats enable row level security;

create policy "Users can read own weekly stats"
  on public.weekly_stats for select using (auth.uid() = user_id);
create policy "Users can insert own weekly stats"
  on public.weekly_stats for insert with check (auth.uid() = user_id);
create policy "Users can update own weekly stats"
  on public.weekly_stats for update using (auth.uid() = user_id);

-- ── 9. Auto-create profile on signup ────────────────────────
-- Trigger function: insert a profiles row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if any, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 10. updated_at auto-touch ───────────────────────────────
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists onboarding_updated_at on public.onboarding;
create trigger onboarding_updated_at before update on public.onboarding
  for each row execute function public.touch_updated_at();

drop trigger if exists budgets_updated_at on public.budgets;
create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.touch_updated_at();

drop trigger if exists blocking_settings_updated_at on public.blocking_settings;
create trigger blocking_settings_updated_at before update on public.blocking_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.touch_updated_at();

drop trigger if exists weekly_stats_updated_at on public.weekly_stats;
create trigger weekly_stats_updated_at before update on public.weekly_stats
  for each row execute function public.touch_updated_at();
