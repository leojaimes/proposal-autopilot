CREATE TABLE "shared_upwork_job_segments" (
    "job_id" UUID NOT NULL,
    "segment" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_upwork_job_segments_pkey" PRIMARY KEY ("job_id", "segment")
);

CREATE INDEX "shared_upwork_job_segments_segment_idx"
ON "shared_upwork_job_segments"("segment");

ALTER TABLE "shared_upwork_job_segments"
ADD CONSTRAINT "shared_upwork_job_segments_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "shared_upwork_jobs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
