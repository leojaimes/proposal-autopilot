CREATE TABLE "market_radar_coverage_windows" (
    "id" UUID NOT NULL,
    "window_start_at" TIMESTAMP(3) NOT NULL,
    "window_end_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_radar_coverage_windows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_radar_coverage_pages" (
    "id" UUID NOT NULL,
    "coverage_window_id" UUID NOT NULL,
    "segment" VARCHAR(50) NOT NULL,
    "query_fingerprint" VARCHAR(255) NOT NULL,
    "input_cursor" TEXT,
    "output_cursor" TEXT,
    "apify_run_id" VARCHAR(100) NOT NULL,
    "apify_dataset_id" VARCHAR(100) NOT NULL,
    "oldest_observed_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_radar_coverage_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_radar_coverage_windows_window_start_at_window_end_at_key"
ON "market_radar_coverage_windows"("window_start_at", "window_end_at");

CREATE UNIQUE INDEX "market_radar_coverage_pages_coverage_window_id_segment_input_cursor_key"
ON "market_radar_coverage_pages"("coverage_window_id", "segment", "input_cursor");

CREATE INDEX "market_radar_coverage_pages_coverage_window_id_segment_recorded_at_idx"
ON "market_radar_coverage_pages"("coverage_window_id", "segment", "recorded_at");

ALTER TABLE "market_radar_coverage_pages"
ADD CONSTRAINT "market_radar_coverage_pages_coverage_window_id_fkey"
FOREIGN KEY ("coverage_window_id") REFERENCES "market_radar_coverage_windows"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
