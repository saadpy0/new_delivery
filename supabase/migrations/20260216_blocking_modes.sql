-- ============================================================
-- Update blocking_settings for new 3-mode system
-- ============================================================

-- 1. Drop the OLD constraint first (it only allows flexible/strict)
ALTER TABLE public.blocking_settings
  DROP CONSTRAINT IF EXISTS blocking_settings_mode_check;

-- 2. Now update existing rows to new valid values
UPDATE public.blocking_settings
  SET mode = 'moderate'
  WHERE mode NOT IN ('gentle', 'moderate', 'precautionary');

-- 3. Add the new constraint
ALTER TABLE public.blocking_settings
  ADD CONSTRAINT blocking_settings_mode_check
  CHECK (mode IN ('gentle', 'moderate', 'precautionary'));

-- 3. Drop old columns that no longer apply
ALTER TABLE public.blocking_settings
  DROP COLUMN IF EXISTS soft_block_enabled,
  DROP COLUMN IF EXISTS cooldown_minutes;

-- 4. Add new columns
ALTER TABLE public.blocking_settings
  ADD COLUMN IF NOT EXISTS super_strict boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cooldown_gentle smallint NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS cooldown_moderate smallint NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cooldown_precautionary smallint NOT NULL DEFAULT 0;
