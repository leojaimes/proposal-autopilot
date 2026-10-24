SET lock_timeout = '3s';

-- Keep every materially different same-day Radar calculation as an immutable
-- revision. Decisions can continue to reference the revision they observed.
ALTER TABLE "market_category_snapshots"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "taxonomy_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "source_lineage" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "content_hash" VARCHAR(64) NOT NULL DEFAULT '';

DROP INDEX "uq_market_snapshot_version";

CREATE UNIQUE INDEX "uq_market_snapshot_revision"
  ON "market_category_snapshots"("tenant_id", "taxonomy_node_id", "as_of", "calculation_version", "revision");

-- PostgreSQL's partial unique index is the invariant Prisma cannot represent:
-- exactly one current revision exists for a category/date/calculation version.
CREATE UNIQUE INDEX "uq_market_snapshot_current"
  ON "market_category_snapshots"("tenant_id", "taxonomy_node_id", "as_of", "calculation_version")
  WHERE "is_current" = true;

CREATE INDEX "market_category_snapshots_tenant_id_is_current_as_of_idx"
  ON "market_category_snapshots"("tenant_id", "is_current", "as_of" DESC);
