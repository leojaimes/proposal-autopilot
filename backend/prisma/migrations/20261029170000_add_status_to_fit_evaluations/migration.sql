SET lock_timeout = '3s';

-- Add status column to fit_evaluations for per-profile status tracking
ALTER TABLE "fit_evaluations"
  ADD COLUMN IF NOT EXISTS "status" "JobStatus" NOT NULL DEFAULT 'NEEDS_REVIEW';

