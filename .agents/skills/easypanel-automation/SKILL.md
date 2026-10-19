---
name: easypanel-automation
description: "Trigger: easypanel, easypanel migration, migrar easypanel, registrar servicio easypanel, easypanel cli, easypanel ssh, easypanel backup, nuevo servidor easypanel, cambiar owner easypanel. Manage, automate, provision, and migrate EasyPanel projects, services, domains, and LMDB database via terminal and SSH."
license: Apache-2.0
metadata:
  author: spotlight-engineering
  version: "1.0"
---

# EasyPanel Automation, Provisioning & Migration

## Activation Contract
Activate this skill whenever you need to:
1. **Provision or register services in EasyPanel via SSH** without using the web UI (e.g., adding `pub-clone`, microservices, or new flavors).
2. **Bind domains and SSL certificates** automatically to existing EasyPanel containers.
3. **Migrate an entire EasyPanel installation** to a new VPS or new owner account without manual data entry.
4. **Inspect or recover** desynchronized Docker Swarm services that do not appear in the EasyPanel dashboard.

---

## 🛑 HARD SAFETY GUARDRAILS (Anti-Data-Loss Contract)

Para proteger la integridad de los 28 servicios y bases de datos en producción:
1. **PROHIBIDO EL BORRADO EN CALIENTE (`db.remove` / DROP / DELETE):**
   - Queda estrictamente prohibido ejecutar operaciones de borrado (`db.remove()`) en `data.mdb`.
   - Cualquier desaprovisionamiento debe hacerse marcando el servicio como `enabled: false` en lugar de borrar la clave.
   - Prohibido `docker volume rm` o `rm -rf /etc/easypanel/projects/*` sin confirmación y dump externo previo.
2. **BACKUP PREVIO OBLIGATORIO AUTOMÁTICO:**
   - Todo script que mute `data.mdb` debe generar automáticamente un snapshot con timestamp (`data.mdb.bak-<timestamp>`) antes de abrir la base de datos en modo escritura.
3. **READ-ONLY POR DEFECTO:**
   - Toda lectura, dump, auditoría o inspección debe abrir LMDB estrictamente con `{ readOnly: true }`.
4. **ROLLBACK DETERMINISTA EN 1-SEGUNDO:**
   - Si una inyección falla o corrompe un esquema, la restauración es inmediata:
     `cp /etc/easypanel/data/data.mdb.bak-<timestamp> /etc/easypanel/data/data.mdb && docker service update --force easypanel`

---

## 🏛️ Architecture Invariants

1. **The Single Source of Truth is LMDB (`data.mdb`)**:
   EasyPanel does NOT derive its dashboard state from Docker or Træfik. It reads from `/etc/easypanel/data/data.mdb` (using Node.js `lmdb`). Any container or Træfik rule created outside LMDB will be ignored by the UI and overwritten during Træfik reconciliations.
2. **Top-Down Provisioning**:
   Always provision through LMDB (`services:<project>:<service>` and `domains:<domainId>`), then trigger Swarm convergence:
   ```bash
   docker service update --force easypanel
   ```
3. **Dynamic Multi-Flavor Frontends**:
   All frontend flavors (`pubmaster`, `nielsen`, `clone`) share the same published image (`ghcr.io/leojaimes/publications-frontend:latest`) on port `3008`, discriminated exclusively via:
   ```env
   PRODUCT_PROFILE=<pubmaster|nielsen|clone>
   NEXT_PUBLIC_PRODUCT_PROFILE=<pubmaster|nielsen|clone>
   ```

---

## 🔐 SECURITY & CREDENTIAL ISOLATION (Zero Hardcoded SSH)

1. **PROHIBIDO HARDCODEAR DATOS DE CONEXIÓN SSH:**
   - Nunca escribas IPs de servidores, nombres de usuario de acceso, rutas absolutas de llaves privadas ni passwords en archivos `.md`, scripts o código fuente.
   - Todo comando o script debe usar placeholders (`<USER>`, `<HOST_IP>`, `<SSH_KEY_PATH>`) o variables de entorno efímeras en memoria (`$EASYPANEL_HOST`, `$EASYPANEL_USER`).
2. **SOLICITUD OBLIGATORIA EN TIEMPO DE EJECUCIÓN:**
   - Si se requiere ejecutar una operación remota, el agente **debe solicitar explícitamente al usuario los datos de conexión** si no están provistos en su entorno actual.

---

## 🛠️ CLI Operations Guide

### 1. Inspect Running Services & Domains
Run inside the `easypanel` container via SSH (replace with runtime values):
```bash
@'
CONTAINER=$(docker ps -q -f name=easypanel.1)
docker exec $CONTAINER node -e '
  const lmdb = require("/app/node_modules/lmdb");
  const db = lmdb.open({ path: "/etc/easypanel/data/data.mdb", readOnly: true });
  for (const { key } of db.getRange({ limit: 1000 })) {
    if (String(key).startsWith("services:")) console.log(key);
  }
'
'@ | ssh <USER>@<HOST_IP> bash
```

### 2. Inject or Clone a Service (e.g. `pub-clone`)
Copy [inject-service.js](file:///d:/SpotlightProjects/publications/.agents/skills/easypanel-automation/scripts/inject-service.js) to the VPS and execute inside the container:
```bash
node inject-service.js <project> <newService> <templateService> '<envOverridesJson>' '<domainsCommaSeparated>'
```

### 3. Server-to-Server Migration (New VPS / Change of Owner)
For complete instructions on moving between VPS providers, transferring databases (Mongo/Postgres), and handing over ownership, follow the [EasyPanel Migration Playbook](file:///d:/SpotlightProjects/publications/.agents/skills/easypanel-automation/references/migration-guide.md).
