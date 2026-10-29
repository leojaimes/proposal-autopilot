# EasyPanel Hostinger VPS Database Migration & Recovery Playbook

## 1. EasyPanel Deployment Pipeline
Proposal Autopilot operates on EasyPanel (Docker Swarm) on Hostinger VPS:
* Service Backend: `proposal-autopilot_proposal-backend`
* Service Database: `proposal-autopilot_proposal-db` (PostgreSQL 17, internal port 5432)
* Container Entrypoint: `backend/scripts/docker-entrypoint.sh` executes `npx prisma migrate deploy` on every deployment before booting NestJS.

## 2. Pre-Migration Remote Snapshot (Mandatory for DDL Changes)
Before rolling out structural database changes or migrations touching live tables, create an isolated dump on the VPS:
```bash
# Execute via SSH to Hostinger VPS:
ssh root@<EASYPANEL_HOST> 'docker exec $(docker ps -q -f name=proposal-autopilot_proposal-db.1) pg_dump -U postgres proposal_autopilot_db > /tmp/proposal_db_pre_migration_$(date +%s).sql'
```

## 3. Remote Verification & Health Checks
Verify migration status on the live EasyPanel container without redeploying:
```bash
ssh root@<EASYPANEL_HOST> 'docker exec $(docker ps -q -f name=proposal-autopilot_proposal-backend.1) npx prisma migrate status'
```

## 4. Crash-Loop Recovery (Unblocking `_prisma_migrations`)
If a remote migration fails during startup:
1. EasyPanel backend restarts every 30s (`exit 1` in entrypoint).
2. Inspect the failed migration record in `_prisma_migrations`:
   ```bash
   node scripts/factory/af.mjs migrate doctor
   ```
   Or remotely on the VPS:
   ```bash
   ssh root@<EASYPANEL_HOST> 'docker exec $(docker ps -q -f name=proposal-autopilot_proposal-backend.1) node dist/scripts/factory/af.mjs migrate doctor'
   ```
3. Mark the failed migration as rolled-back to allow container start:
   ```bash
   ssh root@<EASYPANEL_HOST> 'docker exec $(docker ps -q -f name=proposal-autopilot_proposal-backend.1) npx prisma migrate resolve --rolled-back <migration_name>'
   ```
4. If code rollback is required, trigger instant Swarm rollback:
   ```bash
   node scripts/factory/af.mjs rollback
   # Or via SSH directly:
   ssh root@<EASYPANEL_HOST> 'docker service rollback proposal-autopilot_proposal-backend'
   ```

