SET lock_timeout = '3s';

-- Durable at-least-once taxonomy classification work. A JobPost and its first
-- work record are written in the same transaction by the ingestion path.
CREATE TYPE "TaxonomyClassificationWorkStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRYING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "taxonomy_classification_work" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "job_post_id" UUID NOT NULL,
  "taxonomy_version" INTEGER NOT NULL DEFAULT 1,
  "classifier_version" VARCHAR(50) NOT NULL DEFAULT 'taxonomy-rules-v1',
  "batch_id" VARCHAR(100),
  "input_payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" "TaxonomyClassificationWorkStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "locked_by" VARCHAR(100),
  "last_error" TEXT,
  "completed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "taxonomy_classification_work_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "taxonomy_classification_work_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "taxonomy_classification_work_job_post_id_fkey"
    FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "taxonomy_classification_work_tenant_id_job_post_id_taxonomy_version_key"
  ON "taxonomy_classification_work"("tenant_id", "job_post_id", "taxonomy_version");
CREATE INDEX "taxonomy_classification_work_tenant_id_status_available_at_idx"
  ON "taxonomy_classification_work"("tenant_id", "status", "available_at");
CREATE INDEX "taxonomy_classification_work_batch_id_status_available_at_idx"
  ON "taxonomy_classification_work"("batch_id", "status", "available_at");

-- Preserve the newest assignment deterministically before enforcing one
-- current category. Existing databases may predate the partial invariant.
WITH ranked_primary_assignments AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "job_post_id"
      ORDER BY "classified_at" DESC, "id" DESC
    ) AS rank
  FROM "job_category_assignments"
  WHERE "is_primary" = true
)
UPDATE "job_category_assignments" AS assignment
SET "is_primary" = false
FROM ranked_primary_assignments AS ranked
WHERE assignment."id" = ranked."id"
  AND ranked.rank > 1;

-- The service takes a row lock before it changes the primary assignment. This
-- constraint makes a concurrent implementation error visible rather than
-- allowing two current primary categories for one job.
CREATE UNIQUE INDEX "uq_job_taxonomy_primary_assignment"
  ON "job_category_assignments"("job_post_id")
  WHERE "is_primary" = true;

-- Existing jobs are reconciled after deployment. This initial work makes jobs
-- with no current primary assignment recoverable after a process restart.
INSERT INTO "taxonomy_classification_work" (
  "tenant_id", "job_post_id", "taxonomy_version", "input_payload", "status"
)
SELECT
  job."tenant_id",
  job."id",
  COALESCE(assignment."taxonomy_version", 1),
  '{}'::jsonb,
  CASE
    WHEN job."taxonomy_classification_state" = 'FAILED'::"TaxonomyClassificationState" THEN 'RETRYING'::"TaxonomyClassificationWorkStatus"
    ELSE 'PENDING'::"TaxonomyClassificationWorkStatus"
  END
FROM "job_posts" AS job
LEFT JOIN "job_category_assignments" AS assignment
  ON assignment."job_post_id" = job."id" AND assignment."is_primary" = true
WHERE assignment."id" IS NULL
ON CONFLICT ("tenant_id", "job_post_id", "taxonomy_version") DO NOTHING;
