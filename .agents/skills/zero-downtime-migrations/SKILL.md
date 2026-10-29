---
name: zero-downtime-migrations
description: "Trigger: prisma migrate, easypanel db, actualizar db hostinger, migrar postgresql easypanel, schema.prisma, lock timeout. Non-blocking Prisma migrations, pre-flight snapshots, and safe DDL rollout on EasyPanel Hostinger."
license: Apache-2.0
metadata:
  author: spotlight-engineering
  version: "1.1"
---

## Activation Contract

Activate this skill whenever:
- Modifying `schema.prisma` or creating new Prisma migrations.
- Executing database migrations locally or deploying to EasyPanel on Hostinger VPS.
- Diagnosing blocked migrations, lock timeouts, or container restart loops caused by `_prisma_migrations`.
- Verifying database integrity or running pre/post-migration snapshots.

## Hard Rules

- **Zero Schema Drift (Anti-Drift Guard):** Queda estrictamente prohibido usar `prisma db push` para cambios que van a producción. Toda adición, modificación o eliminación de columnas en `schema.prisma` DEBE contar con su respectivo archivo de migración SQL en `backend/prisma/migrations/`. La aduana de CI/CD (GitHub Actions) y `af finish` bloquearán automáticamente el despliegue si existe desalineación (`prisma migrate diff --exit-code`).
- **Pre-Flight Snapshot:** Always dump the target PostgreSQL database before applying non-trivial DDL in production (`pg_dump` via SSH).
- **Mandatory `lock_timeout`:** Every SQL migration file MUST prepend `SET lock_timeout = '3s';`. Never queue requests behind heavy locks.
- **Expand/Contract Isolation:** Never rename or drop active columns in a single release. Decouple schema expansion from code contraction.
- **No Monolithic DDL/Updates:** Never run table-locking constraints without `NOT VALID`, indexes without `CONCURRENTLY`, or massive `UPDATE`/`DELETE` queries without 1,000–2,000 row batch chunking.
- **Zero Hardcoded Remote Credentials:** Use environment variables (`$EASYPANEL_HOST`, `$EASYPANEL_USER`) or prompt the user; never commit plain credentials.
- **Crash-Loop Guard:** If EasyPanel backend fails during startup migration, diagnose via `af.mjs migrate doctor` or `prisma migrate resolve --rolled-back` before rebooting.

## Decision Gates

| Scenario | Primary Action | Fallback / Reference |
|---|---|---|
| Adding nullable column / constant default | Safe instant metadata change. Generate with `--create-only` and add `lock_timeout`. | [safe-ddl-patterns.md](references/safe-ddl-patterns.md) |
| Adding Foreign Key / Check constraint | Add as `NOT VALID`, then validate in step 2. | [safe-ddl-patterns.md](references/safe-ddl-patterns.md) |
| Creating index | Use `CREATE INDEX CONCURRENTLY IF NOT EXISTS` outside Prisma multi-statement transaction. | [safe-ddl-patterns.md](references/safe-ddl-patterns.md) |
| Deploying to Hostinger EasyPanel | Webhook triggers `docker-entrypoint.sh` (`npx prisma migrate deploy`). Pre-dump required if table >10k rows. | [easypanel-hostinger-playbook.md](references/easypanel-hostinger-playbook.md) |
| Migration failed on EasyPanel | Container restarts every 30s. Run `af.mjs migrate doctor` and resolve rolled back. | [easypanel-hostinger-playbook.md](references/easypanel-hostinger-playbook.md) |

## Execution Steps

1. **Pre-flight Integrity & Status Check:**
   ```bash
   node scripts/factory/af.mjs verify-db --pre
   node scripts/factory/af.mjs migrate status
   ```
2. **Draft & Harden Safe Migration:**
   ```bash
   cd backend && npx prisma migrate dev --create-only --name <migration_name>
   ```
   Edit the generated `migration.sql`:
   - Prepend `SET lock_timeout = '3s';`.
   - Convert blocking constraints to `NOT VALID` + `VALIDATE CONSTRAINT`.
3. **Local Dry-Run & Client Generation:**
   ```bash
   node scripts/factory/af.mjs migrate deploy
   node scripts/factory/af.mjs migrate generate
   ```
4. **Deploy to Hostinger EasyPanel:**
   - Commit and push to `main` (triggers GHCR build + EasyPanel webhook auto-deploy).
   - If manual verification is required on the remote VPS:
     ```bash
     ssh root@$EASYPANEL_HOST 'docker exec $(docker ps -q -f name=proposal-autopilot_proposal-backend.1) npx prisma migrate status'
     ```
5. **Post-Deployment Verification & Diagnostics:**
   ```bash
   node scripts/factory/af.mjs verify-db --post
   ```
   If container crashes: execute `af.mjs migrate doctor` and check remote logs with `af.mjs guardian 60`.

## Output Contract

Return:
- Migration name and execution timestamp.
- DDL safety confirmation (lock timeout, non-blocking constraints/indexes).
- Status on local database (`proposal_autopilot_db` on port 5438).
- Status on Hostinger EasyPanel (`proposal-autopilot_proposal-backend` / `proposal-autopilot_proposal-db`).
- Pre/Post integrity check verification and backup snapshot identifier.

## References

- [safe-ddl-patterns.md](references/safe-ddl-patterns.md) — Safe PostgreSQL DDL, chunked backfills, and concurrent indexing.
- [easypanel-hostinger-playbook.md](references/easypanel-hostinger-playbook.md) — Remote Hostinger EasyPanel operations, backups, and Swarm rollback.
