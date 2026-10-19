/**
 * Injects or updates an EasyPanel service and its domain associations directly into LMDB.
 * Must be executed inside the `easypanel` container on the host.
 *
 * Usage:
 *   node inject-service.js <projectName> <serviceName> <templateServiceName> <envOverridesJson> <domainsCommaSeparated>
 *
 * Example:
 *   node inject-service.js pepper-tix pub-clone pub-nielsen '{"PRODUCT_PROFILE":"clone"}' 'clone.spotlightus.org,pepper-tix-pub-clone.zh4nwb.easypanel.host'
 */

const crypto = require("crypto");
const lmdb = require("/app/node_modules/lmdb");

async function main() {
  const [
    projectName,
    serviceName,
    templateServiceName,
    envOverridesRaw = "{}",
    domainsRaw = ""
  ] = process.argv.slice(2);

  if (!projectName || !serviceName || !templateServiceName) {
    console.error("Usage: node inject-service.js <projectName> <serviceName> <templateServiceName> [envOverridesJson] [domainsCommaSeparated]");
    process.exit(1);
  }

  const envOverrides = JSON.parse(envOverridesRaw);
  const domainHosts = domainsRaw.split(",").map(d => d.trim()).filter(Boolean);

  // 🛑 HARD SAFETY GUARDRAIL: Pre-flight snapshot backup before ANY modification
  const fs = require("fs");
  const dbPath = "/etc/easypanel/data/data.mdb";
  if (fs.existsSync(dbPath)) {
    const backupPath = `${dbPath}.bak-${Date.now()}`;
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[Safety Guardrail] Pre-flight backup created: ${backupPath}`);
  }

  const db = lmdb.open({ path: dbPath, readOnly: false });

  const templateKey = `services:${projectName}:${templateServiceName}`;
  const templateRaw = db.get(templateKey);
  if (!templateRaw) {
    throw new Error(`Template service not found: ${templateKey}`);
  }

  const templateService = JSON.parse(templateRaw);
  const token = crypto.randomBytes(24).toString("hex");

  // Modify environment variables
  let updatedEnv = templateService.json.env || "";
  for (const [key, val] of Object.entries(envOverrides)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(updatedEnv)) {
      updatedEnv = updatedEnv.replace(regex, `${key}=${val}`);
    } else {
      updatedEnv += `\n${key}=${val}`;
    }
  }

  const domainEntities = [];
  let primaryDomainId = null;

  for (let i = 0; i < domainHosts.length; i++) {
    const host = domainHosts[i];
    const domainId = "cm" + crypto.randomBytes(11).toString("hex").slice(0, 23);
    if (i === 0) primaryDomainId = domainId;

    domainEntities.push({
      id: domainId,
      entity: {
        json: {
          certificateResolver: "",
          host: host,
          https: true,
          id: domainId,
          middlewares: [],
          path: "/",
          wildcard: false,
          destinationType: "service",
          serviceDestination: {
            path: "/",
            port: templateService.json.ports?.[0]?.published || 3008,
            projectName: projectName,
            protocol: "http",
            serviceName: serviceName
          }
        }
      }
    });
  }

  const serviceEntity = {
    json: {
      ...templateService.json,
      name: serviceName,
      token: token,
      primaryDomainId: primaryDomainId || templateService.json.primaryDomainId,
      env: updatedEnv
    },
    meta: templateService.meta
  };

  console.log(`Injecting service: services:${projectName}:${serviceName}`);
  await db.put(`services:${projectName}:${serviceName}`, JSON.stringify(serviceEntity));

  for (const dom of domainEntities) {
    console.log(`Injecting domain: domains:${dom.id} (${dom.entity.json.host})`);
    await db.put(`domains:${dom.id}`, JSON.stringify(dom.entity));
  }

  await db.flushed;
  console.log("Successfully flushed to LMDB data.mdb!");
}

main().catch(err => {
  console.error("Injection failed:", err);
  process.exit(1);
});
