# Safe PostgreSQL DDL Patterns & Expand/Contract Protocol

## 1. Column Operations
* **Add Nullable Column:**
  ```sql
  ALTER TABLE "JobPost" ADD COLUMN "sourceFeed" TEXT;
  ```
* **Add Column with Constant Default:**
  ```sql
  ALTER TABLE "JobPost" ADD COLUMN "categoryVersion" INTEGER NOT NULL DEFAULT 1;
  ```
* **Add Column with Dynamic Default (`now()`, functions):**
  1. Add column as `NULL` without default.
  2. Batch backfill historical rows.
  3. Alter column to `SET NOT NULL` / `SET DEFAULT`.

## 2. Constraints & Foreign Keys (2-Step Validation)
* Never add constraints directly on large tables (locks table during full scan).
* Always decouple validation:
  ```sql
  -- Step 1: Instant metadata lock without validating historical data
  ALTER TABLE "JobPost" ADD CONSTRAINT "fk_tenant" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") NOT VALID;

  -- Step 2: Validate existing rows concurrently without blocking writes
  ALTER TABLE "JobPost" VALIDATE CONSTRAINT "fk_tenant";
  ```

## 3. Concurrent Indexing
* Standard `CREATE INDEX` acquires `SHARE` lock and blocks concurrent writes.
* Always use `CONCURRENTLY`:
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_post_title" ON "JobPost"("title");
  ```
* *Prisma caveat*: Prisma transactions block `CONCURRENTLY`. For Prisma migrations with concurrent indexes, disable transaction mode or run raw SQL outside a multi-statement transaction.

## 4. Batched Backfills (Chunking Loop)
Never execute unconstrained `UPDATE <table> SET ...` in production. Chunk updates to prevent WAL bloat and connection starvation:
```sql
DO $$ 
DECLARE 
    rows_affected INT;
BEGIN 
    LOOP 
        UPDATE "JobPost" 
        SET "classificationStatus" = 'COMPLETED' 
        WHERE "id" IN (
            SELECT "id" FROM "JobPost" 
            WHERE "classificationStatus" IS NULL 
            LIMIT 2000
        );
        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        EXIT WHEN rows_affected = 0;
        PERFORM pg_sleep(0.05);
    END LOOP; 
END $$;
```

