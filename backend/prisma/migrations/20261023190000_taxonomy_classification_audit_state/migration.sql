-- Make every accepted job's taxonomy lifecycle visible and queryable.
CREATE TYPE "TaxonomyClassificationState" AS ENUM ('PENDING', 'CLASSIFIED', 'FALLBACK', 'FAILED');

ALTER TABLE "job_posts"
  ADD COLUMN "taxonomy_classification_state" "TaxonomyClassificationState" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "taxonomy_classifier_version" VARCHAR(50),
  ADD COLUMN "taxonomy_fallback_reason" VARCHAR(100),
  ADD COLUMN "taxonomy_classification_error" TEXT,
  ADD COLUMN "taxonomy_classified_at" TIMESTAMP(3);

ALTER TABLE "job_category_assignments"
  ADD COLUMN "taxonomy_version" INTEGER NOT NULL DEFAULT 1;

-- Preserve the taxonomy revision that actually owns each historical assignment.
UPDATE "job_category_assignments" AS assignment
SET "taxonomy_version" = taxonomy."taxonomy_version"
FROM "market_taxonomy_nodes" AS taxonomy
WHERE taxonomy."id" = assignment."taxonomy_node_id";

-- Existing primary assignments become explicitly auditable. Jobs without one
-- remain PENDING so reconciliation can find them.
UPDATE "job_posts" AS job
SET
  "taxonomy_classification_state" = CASE
    WHEN assignment."evidence" ->> 'fallbackReason' IS NOT NULL THEN 'FALLBACK'::"TaxonomyClassificationState"
    ELSE 'CLASSIFIED'::"TaxonomyClassificationState"
  END,
  "taxonomy_classifier_version" = assignment."classifier_version",
  "taxonomy_fallback_reason" = assignment."evidence" ->> 'fallbackReason',
  "taxonomy_classified_at" = assignment."classified_at"
FROM "job_category_assignments" AS assignment
WHERE assignment."job_post_id" = job."id"
  AND assignment."is_primary" = true;

CREATE INDEX "job_posts_tenant_id_taxonomy_classification_state_idx"
  ON "job_posts"("tenant_id", "taxonomy_classification_state");
