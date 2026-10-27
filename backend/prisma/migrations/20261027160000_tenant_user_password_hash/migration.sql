SET lock_timeout = '3s';

-- Add password_hash and updated_at to tenant_users
ALTER TABLE "tenant_users"
  ADD COLUMN IF NOT EXISTS "password_hash" VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
