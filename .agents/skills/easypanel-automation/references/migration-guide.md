# EasyPanel Server-to-Server Migration Playbook

This document details the exact protocol to migrate all projects, services, databases, persistent volumes, environment variables, and SSL domains from an existing EasyPanel server to a fresh server with a **new owner/account**.

---

## 🎯 Why this is necessary
EasyPanel currently has no built-in "Transfer Organization/Owner" button. If the person paying for the VPS or the EasyPanel instance changes, you must spin up a new VPS and migrate the stack cleanly.

---

## 📋 Pre-Flight Checklist (On New VPS)
1. **Provision new VPS** (Ubuntu 22.04 / 24.04 recommended).
2. **Install Docker and EasyPanel:**
   ```bash
   curl -sSL https://get.easypanel.io | sh
   ```
3. **Initial Setup:**
   - Open `http://<NEW_VPS_IP>:3000`.
   - The **new owner** creates their account (this owner now controls the billing and instance).

---

## 📦 Migration Steps

### Phase 1: Export Source State (Old VPS)
1. Export the database records and secrets:
   ```bash
   # Run dump script inside the container
   docker exec $(docker ps -q -f name=easypanel.1) node /path/to/dump-stack.js /tmp/easypanel-stack-dump.json
   ```
2. Backup the raw LMDB data:
   ```bash
   tar -czvf /root/easypanel-data-backup.tar.gz /etc/easypanel/data/
   ```
3. Backup Docker volumes and project code directories:
   ```bash
   tar -czvf /root/easypanel-projects-backup.tar.gz /etc/easypanel/projects/
   ```

### Phase 2: Database Data Migration (MongoDB / Postgres / Redis)
*Note: Never rely only on file copying for active databases.*
1. **MongoDB:**
   ```bash
   docker exec -i $(docker ps -q -f name=mongo) mongodump --archive=/tmp/mongo_backup.archive --gzip
   docker cp $(docker ps -q -f name=mongo):/tmp/mongo_backup.archive /root/mongo_backup.archive
   ```
2. **Postgres:**
   ```bash
   docker exec -i $(docker ps -q -f name=postgres) pg_dumpall -U postgres > /root/postgres_backup.sql
   ```

### Phase 3: Transfer to New VPS
From the old VPS (or your local machine):
```bash
rsync -avz -e "ssh" /root/*.tar.gz /root/*backup* <NEW_USER>@<NEW_VPS_IP>:/root/
```

### Phase 4: Restore on New VPS
1. **Restore Projects Directory:**
   ```bash
   tar -xzvf /root/easypanel-projects-backup.tar.gz -C /
   ```
2. **Inject Services into New EasyPanel:**
   - Use `inject-service.js` or restore `data.mdb`.
   - Note: If restoring `data.mdb` directly, preserve the new owner's user record in the `users` table/key so they retain ownership!
3. **Import Database Data:**
   - Restore MongoDB with `mongorestore --archive=... --gzip`.
   - Restore Postgres with `psql -U postgres < ...`.
4. **Trigger EasyPanel Swarm Convergence:**
   ```bash
   docker service update --force easypanel
   ```

### Phase 5: DNS Cutover (GoDaddy / Cloudflare)
1. Update DNS records (Type `A`) in GoDaddy (`spotlightus.org`, `*.spotlightus.org`, etc.) pointing from `<OLD_VPS_IP>` to `<NEW_VPS_IP>`.
2. Træfik on the new VPS will automatically generate new Let's Encrypt certificates once DNS propagates!
