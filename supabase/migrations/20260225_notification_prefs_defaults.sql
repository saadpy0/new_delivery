-- Ensure reminder defaults are OFF for new and untouched onboarding rows.

alter table public.onboarding
  alter column notification_prefs
  set default '{"budget_reminders": false, "cooking_ideas": false}'::jsonb;

-- Backfill rows that still carry the old implicit default shape.
update public.onboarding
set notification_prefs = jsonb_build_object(
  'budget_reminders', false,
  'cooking_ideas', false
)
where notification_prefs = '{"budget_reminders": true, "cooking_ideas": true}'::jsonb;
