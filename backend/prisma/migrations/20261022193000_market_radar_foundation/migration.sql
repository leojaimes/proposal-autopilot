-- CreateEnum
CREATE TYPE "MarketTaxonomySource" AS ENUM ('UPWORK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MarketTaxonomyKind" AS ENUM ('CATEGORY', 'SUBCATEGORY', 'OCCUPATION', 'SKILL');

-- CreateEnum
CREATE TYPE "MarketCategoryLane" AS ENUM ('CORE', 'ADJACENT', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "JobCategoryAssignmentSource" AS ENUM ('UPWORK', 'RULES', 'AI', 'MANUAL');

-- CreateTable
CREATE TABLE "market_taxonomy_nodes" (
    "id" UUID NOT NULL,
    "source" "MarketTaxonomySource" NOT NULL DEFAULT 'UPWORK',
    "external_id" VARCHAR(150),
    "slug" VARCHAR(150) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "kind" "MarketTaxonomyKind" NOT NULL,
    "parent_id" UUID,
    "taxonomy_version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_taxonomy_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_category_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "taxonomy_node_id" UUID NOT NULL,
    "lane" "MarketCategoryLane" NOT NULL DEFAULT 'ADJACENT',
    "include_terms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "exclude_terms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_category_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_category_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_post_id" UUID NOT NULL,
    "taxonomy_node_id" UUID NOT NULL,
    "source" "JobCategoryAssignmentSource" NOT NULL DEFAULT 'UPWORK',
    "confidence" DECIMAL(5,4),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "classifier_version" VARCHAR(50) NOT NULL DEFAULT 'v1',
    "evidence" JSONB,
    "classified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_category_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_category_assignment_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

-- CreateTable
CREATE TABLE "market_category_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "taxonomy_node_id" UUID NOT NULL,
    "as_of" DATE NOT NULL,
    "demand_7d" INTEGER NOT NULL DEFAULT 0,
    "demand_30d" INTEGER NOT NULL DEFAULT 0,
    "median_proposals" DECIMAL(10,2),
    "median_budget" DECIMAL(12,2),
    "verified_clients_pct" DECIMAL(5,2),
    "sample_jobs" INTEGER NOT NULL DEFAULT 0,
    "sample_confidence" DECIMAL(5,2),
    "source_batch_count" INTEGER NOT NULL DEFAULT 0,
    "calculation_version" VARCHAR(50) NOT NULL DEFAULT 'v1',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_category_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_snapshot_evidence_jobs" (
    "snapshot_id" UUID NOT NULL,
    "job_post_id" UUID NOT NULL,

    CONSTRAINT "market_snapshot_evidence_jobs_pkey" PRIMARY KEY ("snapshot_id", "job_post_id")
);

-- CreateTable
CREATE TABLE "profile_opportunity_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID,
    "market_category_snapshot_id" UUID NOT NULL,
    "lane" "MarketCategoryLane" NOT NULL DEFAULT 'ADJACENT',
    "profile_fit" DECIMAL(5,2),
    "overall_opportunity" DECIMAL(5,2),
    "fit_sample_jobs" INTEGER NOT NULL DEFAULT 0,
    "calculation_version" VARCHAR(50) NOT NULL DEFAULT 'v1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_opportunity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_taxonomy_nodes_slug_key" ON "market_taxonomy_nodes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "uq_taxonomy_source_external_id" ON "market_taxonomy_nodes"("source", "external_id");

-- CreateIndex
CREATE INDEX "market_taxonomy_nodes_parent_id_is_active_idx" ON "market_taxonomy_nodes"("parent_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_profile_taxonomy_policy" ON "profile_category_policies"("profile_id", "taxonomy_node_id");

-- CreateIndex
CREATE INDEX "profile_category_policies_tenant_id_is_active_idx" ON "profile_category_policies"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_job_taxonomy_assignment" ON "job_category_assignments"("job_post_id", "taxonomy_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_job_category_assignments_primary" ON "job_category_assignments"("job_post_id") WHERE "is_primary" = true;

-- CreateIndex
CREATE INDEX "job_category_assignments_tenant_id_taxonomy_node_id_classified_at_idx" ON "job_category_assignments"("tenant_id", "taxonomy_node_id", "classified_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_market_snapshot_version" ON "market_category_snapshots"("tenant_id", "taxonomy_node_id", "as_of", "calculation_version");

-- CreateIndex
CREATE INDEX "market_category_snapshots_tenant_id_as_of_idx" ON "market_category_snapshots"("tenant_id", "as_of" DESC);

-- CreateIndex
CREATE INDEX "market_snapshot_evidence_jobs_job_post_id_idx" ON "market_snapshot_evidence_jobs"("job_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_profile_opportunity_snapshot" ON "profile_opportunity_snapshots"("profile_id", "market_category_snapshot_id", "calculation_version");

-- CreateIndex
CREATE INDEX "profile_opportunity_snapshots_tenant_id_created_at_idx" ON "profile_opportunity_snapshots"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "market_taxonomy_nodes" ADD CONSTRAINT "market_taxonomy_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "market_taxonomy_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_category_policies" ADD CONSTRAINT "profile_category_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_category_policies" ADD CONSTRAINT "profile_category_policies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "positioning_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_category_policies" ADD CONSTRAINT "profile_category_policies_taxonomy_node_id_fkey" FOREIGN KEY ("taxonomy_node_id") REFERENCES "market_taxonomy_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_category_assignments" ADD CONSTRAINT "job_category_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_category_assignments" ADD CONSTRAINT "job_category_assignments_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_category_assignments" ADD CONSTRAINT "job_category_assignments_taxonomy_node_id_fkey" FOREIGN KEY ("taxonomy_node_id") REFERENCES "market_taxonomy_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_category_snapshots" ADD CONSTRAINT "market_category_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_category_snapshots" ADD CONSTRAINT "market_category_snapshots_taxonomy_node_id_fkey" FOREIGN KEY ("taxonomy_node_id") REFERENCES "market_taxonomy_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_snapshot_evidence_jobs" ADD CONSTRAINT "market_snapshot_evidence_jobs_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "market_category_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_snapshot_evidence_jobs" ADD CONSTRAINT "market_snapshot_evidence_jobs_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_opportunity_snapshots" ADD CONSTRAINT "profile_opportunity_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_opportunity_snapshots" ADD CONSTRAINT "profile_opportunity_snapshots_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "positioning_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_opportunity_snapshots" ADD CONSTRAINT "profile_opportunity_snapshots_market_category_snapshot_id_fkey" FOREIGN KEY ("market_category_snapshot_id") REFERENCES "market_category_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
