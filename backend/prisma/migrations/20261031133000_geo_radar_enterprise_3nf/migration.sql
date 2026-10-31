-- Idempotent Enterprise Geo-Radar 3NF & Multi-Channel CRM Migration

-- 1. Enums (Idempotent creation + enum value extension)
DO $$ BEGIN
  CREATE TYPE "CompanyPainCategory" AS ENUM (
    'NO_WEBSITE',
    'WEBSITE_DOWN_OR_EXPIRED',
    'OUTDATED_OR_SLOW_WEB',
    'NO_ONLINE_BOOKING',
    'UNRESPONSIVE_CUSTOMER_SERVICE',
    'MANUAL_INVENTORY_OR_CATALOG',
    'LACK_OF_ECOMMERCE',
    'GENERAL_REPUTATION_ISSUE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "CompanyPainCategory" ADD VALUE IF NOT EXISTS 'WEBSITE_DOWN_OR_EXPIRED';

DO $$ BEGIN
  CREATE TYPE "ProspectedLeadStatus" AS ENUM ('DISCOVERED', 'AUDITED', 'CONTACTED', 'DISQUALIFIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BusinessOwnershipType" AS ENUM ('INDEPENDENT', 'CHAIN_BRANCH', 'CORPORATE_HQ');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BusinessOperationalStatus" AS ENUM ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY', 'STALE_OR_INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PhoneLineType" AS ENUM ('MOBILE', 'LANDLINE', 'VOIP', 'INVALID', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailDeliverabilityStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'CATCH_ALL', 'INVALID_BOUNCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BusinessPainLifecycleStatus" AS ENUM (
    'DETECTED',
    'VERIFIED',
    'PITCHED',
    'FALSE_POSITIVE',
    'DISMISSED',
    'RESOLVED_BY_US',
    'RESOLVED_EXTERNALLY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContactChannel" AS ENUM ('WHATSAPP', 'PHONE_CALL', 'EMAIL', 'LINKEDIN', 'IN_PERSON');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecipientRole" AS ENUM ('BUSINESS_OWNER', 'GATEKEEPER_RECEPTION', 'CORPORATE_DECISION_MAKER', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContactOutcome" AS ENUM (
    'CONNECTED_PITCHED',
    'GATEKEEPER_BLOCKED',
    'NO_ANSWER',
    'VOICEMAIL',
    'EMAIL_SENT',
    'NOT_INTERESTED',
    'MEETING_SCHEDULED',
    'CLOSED_WON',
    'OPT_OUT_BLACKLIST'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailDeliveryEvent" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'SPAM_COMPLAINT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Geo Presets Catalog
CREATE TABLE IF NOT EXISTS "geo_presets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(120) NOT NULL,
  "country_code" VARCHAR(5) NOT NULL,
  "country_name" VARCHAR(100) NOT NULL,
  "flag" VARCHAR(10) NOT NULL,
  "state" VARCHAR(100) NOT NULL,
  "state_code" VARCHAR(10),
  "city" VARCHAR(120) NOT NULL,
  "latitude" DECIMAL(10, 7) NOT NULL,
  "longitude" DECIMAL(10, 7) NOT NULL,
  "zoom" INTEGER NOT NULL DEFAULT 13,
  "is_tactical" BOOLEAN NOT NULL DEFAULT false,
  "category" VARCHAR(50),
  "polygon_coordinates" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "geo_presets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "geo_presets_slug_key" ON "geo_presets"("slug");
CREATE INDEX IF NOT EXISTS "geo_presets_country_code_state_idx" ON "geo_presets"("country_code", "state");
CREATE INDEX IF NOT EXISTS "geo_presets_is_tactical_idx" ON "geo_presets"("is_tactical");

-- 3. Corporate Brands (Parent-Child Franchise Resolution)
CREATE TABLE IF NOT EXISTS "corporate_brands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(150) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "root_domain" VARCHAR(180),
  "industry" VARCHAR(100),
  "country_scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "headquarters_city" VARCHAR(100),
  "corporate_website" TEXT,
  "corporate_linkedin" TEXT,
  "is_known_franchise" BOOLEAN NOT NULL DEFAULT false,
  "total_branches_tracked" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corporate_brands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_brands_slug_key" ON "corporate_brands"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_brands_name_key" ON "corporate_brands"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_brands_root_domain_key" ON "corporate_brands"("root_domain");
CREATE INDEX IF NOT EXISTS "corporate_brands_root_domain_idx" ON "corporate_brands"("root_domain");
CREATE INDEX IF NOT EXISTS "corporate_brands_industry_idx" ON "corporate_brands"("industry");

-- 4. Dynamic Company Pain Catalog
CREATE TABLE IF NOT EXISTS "company_pain_catalog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL,
  "category_enum" "CompanyPainCategory",
  "name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "suggested_offer" TEXT NOT NULL,
  "base_ticket_usd" DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
  "monthly_retainer_usd" DECIMAL(10, 2),
  "priority_weight" INTEGER NOT NULL DEFAULT 50,
  "pitch_template_owner" TEXT NOT NULL,
  "pitch_template_gatekeeper" TEXT NOT NULL,
  "pitch_template_enterprise" TEXT NOT NULL,
  "detection_rules" JSONB NOT NULL DEFAULT '{}',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_pain_catalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "company_pain_catalog_code_key" ON "company_pain_catalog"("code");
CREATE INDEX IF NOT EXISTS "company_pain_catalog_is_active_priority_weight_idx" ON "company_pain_catalog"("is_active", "priority_weight");

-- 5. Prospected Businesses (Create if missing + idempotent column upgrades)
CREATE TABLE IF NOT EXISTS "prospected_businesses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "corporate_brand_id" UUID,
  "place_id" VARCHAR(255),
  "name" VARCHAR(255) NOT NULL,
  "branch_identifier" VARCHAR(120),
  "root_domain" VARCHAR(180),
  "ownership_type" "BusinessOwnershipType" NOT NULL DEFAULT 'INDEPENDENT',
  "operational_status" "BusinessOperationalStatus" NOT NULL DEFAULT 'OPERATIONAL',
  "category" VARCHAR(150),
  "address" TEXT,
  "city" VARCHAR(100),
  "state" VARCHAR(100),
  "country" VARCHAR(100) DEFAULT 'Mexico',
  "latitude" DECIMAL(10, 7),
  "longitude" DECIMAL(10, 7),
  "website_url" TEXT,
  "website_http_status" INTEGER,
  "website_checked_at" TIMESTAMP(3),
  "enrichment_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  "phone" VARCHAR(50),
  "phone_e164" VARCHAR(30),
  "phone_type" "PhoneLineType" NOT NULL DEFAULT 'UNKNOWN',
  "email" VARCHAR(180),
  "email_type" VARCHAR(30),
  "email_deliverability" "EmailDeliverabilityStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "rating" DECIMAL(3, 2),
  "reviews_count" INTEGER NOT NULL DEFAULT 0,
  "last_google_review_at" TIMESTAMP(3),
  "price_level" INTEGER,
  "estimated_ticket_usd" DECIMAL(10, 2),
  "status" "ProspectedLeadStatus" NOT NULL DEFAULT 'DISCOVERED',
  "primary_pain" "CompanyPainCategory",
  "pain_confidence" DECIMAL(3, 2),
  "pain_analysis" JSONB,
  "suggested_offer" TEXT,
  "sales_pitch_draft" TEXT,
  "last_contacted_at" TIMESTAMP(3),
  "contact_cooldown_until" TIMESTAMP(3),
  "contact_attempts_count" INTEGER NOT NULL DEFAULT 0,
  "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
  "do_not_contact_reason" TEXT,
  "raw_google_data" JSONB,
  "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospected_businesses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "corporate_brand_id" UUID;
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "branch_identifier" VARCHAR(120);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "root_domain" VARCHAR(180);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "ownership_type" "BusinessOwnershipType" NOT NULL DEFAULT 'INDEPENDENT';
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "operational_status" "BusinessOperationalStatus" NOT NULL DEFAULT 'OPERATIONAL';
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "website_http_status" INTEGER;
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "website_checked_at" TIMESTAMP(3);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "enrichment_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "phone_e164" VARCHAR(30);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "phone_type" "PhoneLineType" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "email" VARCHAR(180);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "email_type" VARCHAR(30);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "email_deliverability" "EmailDeliverabilityStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "last_google_review_at" TIMESTAMP(3);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "price_level" INTEGER;
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "estimated_ticket_usd" DECIMAL(10, 2);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "last_contacted_at" TIMESTAMP(3);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "contact_cooldown_until" TIMESTAMP(3);
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "contact_attempts_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "do_not_contact" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "prospected_businesses" ADD COLUMN IF NOT EXISTS "do_not_contact_reason" TEXT;

DO $$ BEGIN
  ALTER TABLE "prospected_businesses"
    ADD CONSTRAINT "prospected_businesses_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "prospected_businesses"
    ADD CONSTRAINT "prospected_businesses_corporate_brand_id_fkey"
    FOREIGN KEY ("corporate_brand_id") REFERENCES "corporate_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "prospected_businesses_tenant_id_place_id_key" ON "prospected_businesses"("tenant_id", "place_id");
CREATE INDEX IF NOT EXISTS "prospected_businesses_tenant_id_city_category_idx" ON "prospected_businesses"("tenant_id", "city", "category");
CREATE INDEX IF NOT EXISTS "prospected_businesses_tenant_id_ownership_type_status_idx" ON "prospected_businesses"("tenant_id", "ownership_type", "status");
CREATE INDEX IF NOT EXISTS "prospected_businesses_tenant_id_root_domain_idx" ON "prospected_businesses"("tenant_id", "root_domain");
CREATE INDEX IF NOT EXISTS "prospected_businesses_tenant_id_phone_type_idx" ON "prospected_businesses"("tenant_id", "phone_type");
CREATE INDEX IF NOT EXISTS "prospected_businesses_tenant_id_do_not_contact_contact_cool_idx" ON "prospected_businesses"("tenant_id", "do_not_contact", "contact_cooldown_until");

-- 6. M:N Business Pain Lifecycle Join Table
CREATE TABLE IF NOT EXISTS "prospected_business_pains" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "pain_catalog_id" UUID NOT NULL,
  "status" "BusinessPainLifecycleStatus" NOT NULL DEFAULT 'DETECTED',
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DECIMAL(3, 2) NOT NULL DEFAULT 0.50,
  "adjusted_ticket_usd" DECIMAL(10, 2),
  "evidence" JSONB,
  "custom_pitch_owner" TEXT,
  "custom_pitch_gatekeeper" TEXT,
  "custom_pitch_enterprise" TEXT,
  "dismiss_reason" TEXT,
  "verified_by" VARCHAR(150),
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospected_business_pains_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "prospected_business_pains"
    ADD CONSTRAINT "prospected_business_pains_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "prospected_business_pains"
    ADD CONSTRAINT "prospected_business_pains_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "prospected_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "prospected_business_pains"
    ADD CONSTRAINT "prospected_business_pains_pain_catalog_id_fkey"
    FOREIGN KEY ("pain_catalog_id") REFERENCES "company_pain_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "prospected_business_pains_business_id_pain_catalog_id_key" ON "prospected_business_pains"("business_id", "pain_catalog_id");
CREATE INDEX IF NOT EXISTS "prospected_business_pains_tenant_id_status_idx" ON "prospected_business_pains"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "prospected_business_pains_business_id_is_primary_idx" ON "prospected_business_pains"("business_id", "is_primary");

-- 7. Omnichannel Contact & Email Telemetry Log
CREATE TABLE IF NOT EXISTS "prospect_contact_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "pain_catalog_id" UUID,
  "contacted_by" VARCHAR(150),
  "channel" "ContactChannel" NOT NULL,
  "recipient_role" "RecipientRole" NOT NULL DEFAULT 'UNKNOWN',
  "pitch_tone_used" VARCHAR(30),
  "outcome" "ContactOutcome" NOT NULL,
  "notes" TEXT,
  "next_followup_date" TIMESTAMP(3),
  "email_subject" VARCHAR(255),
  "email_message_id" VARCHAR(255),
  "email_event" "EmailDeliveryEvent",
  "opened_at" TIMESTAMP(3),
  "clicked_at" TIMESTAMP(3),
  "replied_at" TIMESTAMP(3),
  "bounced_at" TIMESTAMP(3),
  "contacted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospect_contact_logs_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "prospect_contact_logs"
    ADD CONSTRAINT "prospect_contact_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "prospect_contact_logs"
    ADD CONSTRAINT "prospect_contact_logs_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "prospected_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "prospect_contact_logs"
    ADD CONSTRAINT "prospect_contact_logs_pain_catalog_id_fkey"
    FOREIGN KEY ("pain_catalog_id") REFERENCES "company_pain_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "prospect_contact_logs_email_message_id_key" ON "prospect_contact_logs"("email_message_id");
CREATE INDEX IF NOT EXISTS "prospect_contact_logs_tenant_id_business_id_contacted_at_idx" ON "prospect_contact_logs"("tenant_id", "business_id", "contacted_at");
CREATE INDEX IF NOT EXISTS "prospect_contact_logs_tenant_id_channel_outcome_idx" ON "prospect_contact_logs"("tenant_id", "channel", "outcome");
CREATE INDEX IF NOT EXISTS "prospect_contact_logs_email_message_id_idx" ON "prospect_contact_logs"("email_message_id");

