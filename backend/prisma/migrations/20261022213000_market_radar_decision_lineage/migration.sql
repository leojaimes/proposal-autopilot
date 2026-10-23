CREATE TYPE "MarketRadarDecisionStatus" AS ENUM ('PRIORITIZED', 'WATCHED', 'DISMISSED');

CREATE TABLE "market_radar_decisions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "market_category_snapshot_id" UUID NOT NULL,
  "positioning_profile_id" UUID,
  "taxonomy_node_id" UUID NOT NULL,
  "status" "MarketRadarDecisionStatus" NOT NULL,
  "rationale" TEXT NOT NULL,
  "operator_label" VARCHAR(150) NOT NULL,
  "snapshot_context" JSONB NOT NULL,
  "profile_context" JSONB NOT NULL,
  "evidence_job_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_radar_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_radar_decision_outcomes" (
  "id" UUID NOT NULL,
  "market_radar_decision_id" UUID NOT NULL,
  "job_post_id" UUID,
  "proposal_id" UUID,
  "submitted_at" TIMESTAMP(3),
  "qualified_replied_at" TIMESTAMP(3),
  "interviewed_at" TIMESTAMP(3),
  "won_at" TIMESTAMP(3),
  "realized_value" DECIMAL(12,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "market_radar_decision_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_radar_decision_outcomes_market_radar_decision_id_key"
  ON "market_radar_decision_outcomes"("market_radar_decision_id");
CREATE INDEX "market_radar_decisions_tenant_id_created_at_idx"
  ON "market_radar_decisions"("tenant_id", "created_at" DESC);
CREATE INDEX "market_radar_decisions_market_category_snapshot_id_idx"
  ON "market_radar_decisions"("market_category_snapshot_id");
CREATE INDEX "market_radar_decisions_positioning_profile_id_idx"
  ON "market_radar_decisions"("positioning_profile_id");
CREATE INDEX "market_radar_decision_outcomes_job_post_id_idx"
  ON "market_radar_decision_outcomes"("job_post_id");
CREATE INDEX "market_radar_decision_outcomes_proposal_id_idx"
  ON "market_radar_decision_outcomes"("proposal_id");

ALTER TABLE "market_radar_decisions"
  ADD CONSTRAINT "market_radar_decisions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "market_radar_decisions_market_category_snapshot_id_fkey"
  FOREIGN KEY ("market_category_snapshot_id") REFERENCES "market_category_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "market_radar_decisions_positioning_profile_id_fkey"
  FOREIGN KEY ("positioning_profile_id") REFERENCES "positioning_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "market_radar_decisions_taxonomy_node_id_fkey"
  FOREIGN KEY ("taxonomy_node_id") REFERENCES "market_taxonomy_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "market_radar_decision_outcomes"
  ADD CONSTRAINT "market_radar_decision_outcomes_market_radar_decision_id_fkey"
  FOREIGN KEY ("market_radar_decision_id") REFERENCES "market_radar_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "market_radar_decision_outcomes_job_post_id_fkey"
  FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "market_radar_decision_outcomes_proposal_id_fkey"
  FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
