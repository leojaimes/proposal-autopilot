CREATE TYPE "SharedUpworkSourceKind" AS ENUM ('HISTORICAL', 'LIVE');

ALTER TABLE "shared_upwork_jobs"
  ADD COLUMN "source_kind" "SharedUpworkSourceKind" NOT NULL DEFAULT 'HISTORICAL',
  ADD COLUMN "source_actor_id" VARCHAR(100) NOT NULL DEFAULT 'hyperbach/upwork-jobs-history',
  ADD COLUMN "source_observed_at" TIMESTAMP(3);

CREATE INDEX "shared_upwork_jobs_source_kind_posted_at_idx"
  ON "shared_upwork_jobs"("source_kind", "posted_at");
