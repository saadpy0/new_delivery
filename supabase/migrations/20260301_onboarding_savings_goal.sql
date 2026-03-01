-- Add savings goal selected during onboarding.

alter table public.onboarding
  add column if not exists savings_goal text;
