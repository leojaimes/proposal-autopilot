-- CreateEnum
CREATE TYPE "StrategicLane" AS ENUM ('CORE_AI_UX', 'PRODUCT_STRATEGY', 'INTERFACE_BUILD', 'UX_RESEARCH', 'DISQUALIFIED_NOISE');

-- CreateEnum
CREATE TYPE "DeliveryArchetype" AS ENUM ('PRODUCT_DEFINITION_0_TO_1', 'DESIGN_SYSTEM_ARCHITECTURE', 'HEURISTIC_AUDIT_RESEARCH', 'AD_HOC_EXECUTION', 'TEACHING_OR_CONTENT');

-- CreateEnum
CREATE TYPE "FitTier" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NEEDS_REVIEW', 'APPROVED', 'APPLIED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('HOURLY', 'FIXED', 'NOT_SHOWN');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "upwork_profile_url" TEXT,
    "base_hourly_rate" DECIMAL(10,2) DEFAULT 65.00,
    "monthly_connects_budget" INTEGER NOT NULL DEFAULT 150,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_credentials" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "is_healthy" BOOLEAN NOT NULL DEFAULT true,
    "last_validated_at" TIMESTAMP(3),

    CONSTRAINT "tenant_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positioning_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "offer_headline" VARCHAR(255) NOT NULL,
    "target_audience" TEXT NOT NULL,
    "voice_rules" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positioning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_stories" (
    "id" UUID NOT NULL,
    "positioning_profile_id" UUID NOT NULL,
    "key_code" VARCHAR(50) NOT NULL,
    "company_or_product" VARCHAR(100) NOT NULL,
    "impact_metric" TEXT NOT NULL,
    "domain_tags" TEXT[],

    CONSTRAINT "proof_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "search_keywords" TEXT[],
    "min_budget_fixed" DECIMAL(10,2) DEFAULT 500.00,
    "min_hourly_rate" DECIMAL(10,2) DEFAULT 40.00,
    "recency_days" INTEGER NOT NULL DEFAULT 3,
    "verified_payment_only" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "scrape_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "jobs_found" INTEGER NOT NULL DEFAULT 0,
    "high_fit_count" INTEGER NOT NULL DEFAULT 0,
    "medium_fit_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',

    CONSTRAINT "batch_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_posts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "batch_run_id" UUID,
    "external_upwork_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "budget_type" "BudgetType" NOT NULL DEFAULT 'NOT_SHOWN',
    "budget_fixed" DECIMAL(10,2),
    "hourly_min" DECIMAL(10,2),
    "hourly_max" DECIMAL(10,2),
    "raw_budget_text" VARCHAR(100),
    "client_country" VARCHAR(100),
    "client_rating" DECIMAL(3,2) DEFAULT 0,
    "client_total_spend" DECIMAL(12,2) DEFAULT 0,
    "proposals_count" INTEGER NOT NULL DEFAULT 0,
    "is_payment_verified" BOOLEAN NOT NULL DEFAULT false,
    "job_url" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "raw_apify_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fit_evaluations" (
    "id" UUID NOT NULL,
    "job_post_id" UUID NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "fit_tier" "FitTier" NOT NULL,
    "strategic_lane" "StrategicLane" NOT NULL DEFAULT 'DISQUALIFIED_NOISE',
    "normalized_role" VARCHAR(100) NOT NULL,
    "skill_score" INTEGER NOT NULL,
    "ai_feasibility_score" INTEGER NOT NULL,
    "client_quality_score" INTEGER NOT NULL,
    "recency_score" INTEGER NOT NULL,
    "is_capped" BOOLEAN NOT NULL DEFAULT false,
    "cap_reason" VARCHAR(255),
    "summary_rationale" TEXT NOT NULL,
    "detected_gaps" TEXT,
    "suggested_proof_story" VARCHAR(50),
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fit_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "job_post_id" UUID NOT NULL,
    "contact_name" VARCHAR(100),
    "cover_letter_35_words" VARCHAR(350) NOT NULL,
    "technical_proposal_body" TEXT NOT NULL,
    "mermaid_diagram_code" TEXT,
    "public_walkthrough_slug" VARCHAR(100),
    "google_doc_url" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_email_key" ON "tenant_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_credentials_tenant_id_provider_key" ON "tenant_credentials"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "job_posts_tenant_id_posted_at_idx" ON "job_posts"("tenant_id", "posted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "job_posts_tenant_id_external_upwork_id_key" ON "job_posts"("tenant_id", "external_upwork_id");

-- CreateIndex
CREATE UNIQUE INDEX "fit_evaluations_job_post_id_key" ON "fit_evaluations"("job_post_id");

-- CreateIndex
CREATE INDEX "fit_evaluations_overall_score_idx" ON "fit_evaluations"("overall_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "proposals_job_post_id_key" ON "proposals"("job_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_public_walkthrough_slug_key" ON "proposals"("public_walkthrough_slug");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_credentials" ADD CONSTRAINT "tenant_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positioning_profiles" ADD CONSTRAINT "positioning_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_stories" ADD CONSTRAINT "proof_stories_positioning_profile_id_fkey" FOREIGN KEY ("positioning_profile_id") REFERENCES "positioning_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_configs" ADD CONSTRAINT "scrape_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_runs" ADD CONSTRAINT "batch_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_batch_run_id_fkey" FOREIGN KEY ("batch_run_id") REFERENCES "batch_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_evaluations" ADD CONSTRAINT "fit_evaluations_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
