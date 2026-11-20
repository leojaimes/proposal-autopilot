SET lock_timeout = '3s';

CREATE TABLE "market_historical_estimates" (
    "segment" VARCHAR(50) NOT NULL,
    "actor" VARCHAR(100) NOT NULL,
    "run_id" VARCHAR(100) NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    CONSTRAINT "market_historical_estimates_pkey" PRIMARY KEY ("segment")
);
