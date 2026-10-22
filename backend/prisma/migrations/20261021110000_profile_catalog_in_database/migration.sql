ALTER TABLE "positioning_profiles"
  ADD COLUMN IF NOT EXISTS "persona_name" VARCHAR(150) NOT NULL DEFAULT 'Consultor',
  ADD COLUMN IF NOT EXISTS "role_title" VARCHAR(255) NOT NULL DEFAULT 'Consultor',
  ADD COLUMN IF NOT EXISTS "search_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "min_budget_fixed" DECIMAL(10,2) DEFAULT 1000.00,
  ADD COLUMN IF NOT EXISTS "min_hourly_rate" DECIMAL(10,2) DEFAULT 40.00,
  ADD COLUMN IF NOT EXISTS "verified_payment_only" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "weight_skill" INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS "weight_ai" INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS "weight_client" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "weight_recency" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "target_countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "target_regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "excluded_countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "geo_filter_mode" VARCHAR(30) NOT NULL DEFAULT 'WEIGHTED_PREFERENCE',
  ADD COLUMN IF NOT EXISTS "core_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "hybrid_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "tangential_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "excluded_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "profile_catalog_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "proof_stories"
  ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';

ALTER TABLE "scrape_configs"
  ADD COLUMN IF NOT EXISTS "target_countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "target_regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "excluded_countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "geo_filter_mode" VARCHAR(30) NOT NULL DEFAULT 'WEIGHTED_PREFERENCE';

ALTER TABLE "fit_evaluations"
  ADD COLUMN IF NOT EXISTS "positioning_profile_id" UUID;

ALTER TABLE "proposals"
  ADD COLUMN IF NOT EXISTS "positioning_profile_id" UUID;

WITH ranked_profiles AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id, persona_name ORDER BY created_at, id) AS duplicate_number
  FROM "positioning_profiles"
)
UPDATE "positioning_profiles" profile
SET persona_name = LEFT(profile.persona_name, 140) || ' (' || ranked_profiles.duplicate_number || ')'
FROM ranked_profiles
WHERE profile.id = ranked_profiles.id AND ranked_profiles.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "positioning_profiles_tenant_id_persona_name_key"
  ON "positioning_profiles"("tenant_id", "persona_name");

DROP INDEX IF EXISTS "fit_evaluations_job_post_id_key";
DROP INDEX IF EXISTS "proposals_job_post_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "fit_evaluations_job_post_id_positioning_profile_id_key"
  ON "fit_evaluations"("job_post_id", "positioning_profile_id");
CREATE UNIQUE INDEX IF NOT EXISTS "proposals_job_post_id_positioning_profile_id_key"
  ON "proposals"("job_post_id", "positioning_profile_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fit_evaluations_positioning_profile_id_fkey') THEN
    ALTER TABLE "fit_evaluations" ADD CONSTRAINT "fit_evaluations_positioning_profile_id_fkey"
      FOREIGN KEY ("positioning_profile_id") REFERENCES "positioning_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposals_positioning_profile_id_fkey') THEN
    ALTER TABLE "proposals" ADD CONSTRAINT "proposals_positioning_profile_id_fkey"
      FOREIGN KEY ("positioning_profile_id") REFERENCES "positioning_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
