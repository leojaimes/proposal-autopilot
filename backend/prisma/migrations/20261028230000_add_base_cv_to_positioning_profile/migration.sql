SET lock_timeout = '3s';

-- Add base_cv column to positioning_profiles for Publications ATS CV schema
ALTER TABLE "positioning_profiles"
  ADD COLUMN IF NOT EXISTS "base_cv" JSONB;
