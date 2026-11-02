-- CreateTable: prospected_business_contacts
CREATE TABLE IF NOT EXISTS "prospected_business_contacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "full_name" VARCHAR(150) NOT NULL,
  "honorific" VARCHAR(50),
  "title_role" VARCHAR(150),
  "email" VARCHAR(180),
  "phone" VARCHAR(50),
  "phone_e164" VARCHAR(30),
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DECIMAL(3, 2) NOT NULL DEFAULT 0.80,
  "source_url" TEXT,
  "source_provenance" VARCHAR(50) NOT NULL DEFAULT 'ENRICHMENT_LAMBDA',
  "is_manually_verified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospected_business_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: prospected_business_socials
CREATE TABLE IF NOT EXISTS "prospected_business_socials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "platform" VARCHAR(50) NOT NULL,
  "url" TEXT NOT NULL,
  "username" VARCHAR(100),
  "is_verified" BOOLEAN NOT NULL DEFAULT true,
  "source_provenance" VARCHAR(50) NOT NULL DEFAULT 'ENRICHMENT_LAMBDA',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospected_business_socials_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
DO $$ BEGIN
  ALTER TABLE "prospected_business_contacts"
    ADD CONSTRAINT "prospected_business_contacts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "prospected_business_contacts"
    ADD CONSTRAINT "prospected_business_contacts_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "prospected_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "prospected_business_socials"
    ADD CONSTRAINT "prospected_business_socials_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "prospected_business_socials"
    ADD CONSTRAINT "prospected_business_socials_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "prospected_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes & Unique Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "prospected_business_contacts_business_id_full_name_key" ON "prospected_business_contacts"("business_id", "full_name");
CREATE INDEX IF NOT EXISTS "prospected_business_contacts_tenant_id_business_id_idx" ON "prospected_business_contacts"("tenant_id", "business_id");
CREATE INDEX IF NOT EXISTS "prospected_business_contacts_business_id_is_primary_idx" ON "prospected_business_contacts"("business_id", "is_primary");

CREATE UNIQUE INDEX IF NOT EXISTS "prospected_business_socials_business_id_platform_key" ON "prospected_business_socials"("business_id", "platform");
CREATE INDEX IF NOT EXISTS "prospected_business_socials_business_id_idx" ON "prospected_business_socials"("business_id");

