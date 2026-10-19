/**
 * Exports all projects, services, env vars, and domains from EasyPanel LMDB database.
 * Must be executed inside the `easypanel` container or on the host using node and lmdb.
 *
 * Usage:
 *   node dump-stack.js [outputFile]
 */

const fs = require("fs");
const lmdb = require("/app/node_modules/lmdb");

async function main() {
  const outputFile = process.argv[2] || "/tmp/easypanel-stack-dump.json";
  const db = lmdb.open({ path: "/etc/easypanel/data/data.mdb", readOnly: true });

  const dump = {
    timestamp: new Date().toISOString(),
    projects: {},
    services: {},
    domains: {}
  };

  for (const { key, value } of db.getRange({ limit: 5000 })) {
    const k = String(key);
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (k.startsWith("projects:")) {
        const projectName = k.replace("projects:", "");
        dump.projects[projectName] = parsed.json || parsed;
      } else if (k.startsWith("services:")) {
        dump.services[k] = parsed.json || parsed;
      } else if (k.startsWith("domains:")) {
        dump.domains[k] = parsed.json || parsed;
      }
    } catch {
      // skip non-json
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(dump, null, 2), "utf8");
  console.log(`Successfully dumped ${Object.keys(dump.projects).length} projects, ${Object.keys(dump.services).length} services, and ${Object.keys(dump.domains).length} domains to ${outputFile}`);
}

main().catch(err => {
  console.error("Dump failed:", err);
  process.exit(1);
});
