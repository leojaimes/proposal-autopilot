ALTER TABLE "shared_upwork_jobs"
  ADD COLUMN "source_segment" VARCHAR(50);

CREATE INDEX "shared_upwork_jobs_source_segment_posted_at_idx"
  ON "shared_upwork_jobs"("source_segment", "posted_at");
