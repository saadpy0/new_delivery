-- Add RevenueCat trial/debug fields to subscriptions for dashboard verification.
alter table if exists public.subscriptions
  add column if not exists rc_period_type text,
  add column if not exists rc_is_trial boolean not null default false,
  add column if not exists rc_expires_date timestamptz,
  add column if not exists rc_will_renew boolean;
