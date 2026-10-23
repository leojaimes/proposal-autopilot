-- Preserve the difference between an observed zero and a source that omitted the field.
ALTER TABLE "job_posts"
  ADD COLUMN "proposals_count_known" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "payment_verification_known" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "posted_at_known" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "market_category_snapshots"
  ADD COLUMN "metric_coverage" JSONB NOT NULL DEFAULT '{}';
