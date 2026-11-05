CREATE TABLE "shared_upwork_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_upwork_id" VARCHAR(100) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "job_url" TEXT NOT NULL,
  "posted_at" TIMESTAMP(3) NOT NULL,
  "raw_apify_payload" JSONB NOT NULL,
  "source_run_id" VARCHAR(100) NOT NULL,
  "source_dataset_id" VARCHAR(100) NOT NULL,
  "is_protected" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shared_upwork_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shared_upwork_jobs_external_upwork_id_key"
  ON "shared_upwork_jobs"("external_upwork_id");
