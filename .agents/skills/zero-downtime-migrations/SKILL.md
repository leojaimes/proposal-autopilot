---
name: zero-downtime-migrations
description: "Trigger: schema.prisma, prisma migrate, postgresql lock, non-blocking ddl, safe migrations, alter table, expand contract, agregar columna, migración postgresql. Enforces non-blocking, zero-downtime database migrations in PostgreSQL and Prisma using the Expand/Contract pattern, batched backfills, and lock timeouts."
---

# Zero-Downtime Database Migrations (PostgreSQL & Prisma)

This skill provides strict engineering guidelines to execute zero-downtime schema and data changes in PostgreSQL, preventing table locks, connection pool exhaustion, and deployment outages.

---

## 1. The Core Golden Rules

1. **Never Take Long Table Locks:** Any operation acquiring `ACCESS EXCLUSIVE` lock on a production table for more than a few milliseconds is forbidden.
2. **Always Use `lock_timeout`:** Every migration script must start with `SET lock_timeout = '3s';`. If the lock cannot be acquired within 3 seconds, fail fast instead of queueing queries.
3. **Decouple Code from Schema (Expand/Contract):** Always run migrations across multiple phased deployments so both the old and new versions of the application can operate concurrently.
4. **No Monolithic `UPDATE` or `DELETE`:** Large table mutations must be chunked into small batches (1,000–2,000 rows) with small sleeps between batches.

---

## 2. Safe PostgreSQL DDL Patterns

### A. Adding Columns
* **Nullable Columns (`NULL`):**
  ```sql
  -- Safe: Metadata-only change in PostgreSQL 11+
  ALTER TABLE "JobPost" ADD COLUMN "sourceFeed" TEXT;
  ```
* **Columns with Constant Defaults (`NOT NULL DEFAULT ...`):**
  ```sql
  -- Safe in PostgreSQL 11+: Constant defaults update metadata instantly without rewriting the table
  ALTER TABLE "JobPost" ADD COLUMN "categoryVersion" INTEGER NOT NULL DEFAULT 1;
  ```
* **Columns with Non-Constant Defaults (e.g. `now()`, functions):**
  * Do NOT add in one shot! (Rewrites the entire table).
  * Follow Expand/Contract:
    1. Add column as nullable without default.
    2. Backfill existing rows in batches.
    3. Set `NOT NULL` with safe validation.

### B. Adding Constraints & Foreign Keys (2-Step Validation)
* **Unsafe (Table Scan Lock):** `ALTER TABLE "JobPost" ADD CONSTRAINT "fk_tenant" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id");`
* **Safe (Non-Blocking):**
  ```sql
  -- Step 1: Add constraint without validating existing rows (instant, acquires minimal lock)
  ALTER TABLE "JobPost" ADD CONSTRAINT "fk_tenant" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") NOT VALID;

  -- Step 2: Validate existing data concurrently without blocking writes
  ALTER TABLE "JobPost" VALIDATE CONSTRAINT "fk_tenant";
  ```

### C. Creating Indexes (Always `CONCURRENTLY`)
* **Unsafe:** `CREATE INDEX "idx_job_post_title" ON "JobPost"("title");` (Blocks writes until index is built).
* **Safe:**
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_post_title" ON "JobPost"("title");
  ```
  *(Note: Prisma `prisma migrate dev` executes migrations inside a transaction. In PostgreSQL, `CREATE INDEX CONCURRENTLY` cannot run inside a multi-statement transaction block. When adding an index in Prisma, disable the transaction for that migration file or use raw migration).*

### D. Changing Column Types or Renaming Columns
* **Never rename an active column:** It breaks running instances of the older application version immediately.
* **The Expand/Contract workflow for Renaming/Retyping:**
  1. **Expand:** Add the new column with the target name/type (nullable).
  2. **Dual-write:** Update application code to write to both columns and read from the new column with fallback.
  3. **Backfill:** Copy historical data from old column to new column in chunks.
  4. **Contract:** Remove the old column in a later release.

---

## 3. Safe Backfills: The Chunking Protocol

Never execute a naked `UPDATE <table> SET column = value;`. It locks the table and bloats the WAL.

Use this chunking pattern in an SQL script or background migration worker:

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
        
        -- Pause briefly to allow ongoing user traffic and worker transactions to execute
        PERFORM pg_sleep(0.05);
    END LOOP; 
END $$;
```

---

## 4. Prisma-Specific Workflows

When Prisma generates a migration with potentially blocking DDL:
1. Generate migration without applying:
   ```bash
   npx prisma migrate dev --create-only --name <migration-name>
   ```
2. Open `backend/prisma/migrations/<timestamp>_<migration-name>/migration.sql`.
3. Inspect and adjust:
   - Prepend `SET lock_timeout = '3s';`.
   - Ensure all `NOT NULL` columns have defaults or are deferred to backfill.
   - Separate constraint additions into `NOT VALID` followed by `VALIDATE CONSTRAINT`.
4. Apply cleanly to test database:
   ```bash
   npx prisma migrate deploy
   ```

---

## 5. Integration Test Isolation Checklist

When writing integration tests that touch PostgreSQL:
- [ ] Connect strictly to the isolated test database (`proposal_autopilot_test`), never `proposal_autopilot`.
- [ ] Use `randomUUID()` for all newly generated entities (`jobId`, `tenantId`, `batchId`).
- [ ] Always wrap test execution in `try ... finally` blocks to ensure created records are deleted after asserts run.
- [ ] Avoid running `prisma migrate reset` during local unit/integration test loops; rely on idempotent UUIDs.
