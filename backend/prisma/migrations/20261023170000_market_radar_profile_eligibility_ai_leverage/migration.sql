-- CreateEnum
CREATE TYPE "ProfileEligibility" AS ENUM ('ELIGIBLE', 'EXCLUDED', 'PENDING');

-- CreateEnum
CREATE TYPE "MarketAiLeverageState" AS ENUM ('APPLICABLE', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "profile_category_policies"
  ADD COLUMN "ai_leverage_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "profile_opportunity_snapshots"
  ADD COLUMN "profile_eligibility" "ProfileEligibility" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "ai_leverage_state" "MarketAiLeverageState" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "ai_leverage_capability" VARCHAR(255),
  ADD COLUMN "ai_leverage_task" TEXT,
  ADD COLUMN "ai_leverage_explanation" TEXT;
