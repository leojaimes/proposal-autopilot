import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

async function setup() {
  const email = `qa-studio-${Date.now()}@spotlightus.org`;
  const password = "Password123!";
  const companyName = "QA Studio Test";

  console.log(`Registering user ${email}...`);
  const res = await fetch("http://127.0.0.1:7000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, companyName }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to register QA user: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  console.log("Registration successful! User ID:", data.user?.id);

  const session = {
    token: data.accessToken,
    user: data.user,
    tenant: data.tenant,
  };

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: "http://127.0.0.1:7001",
        localStorage: [
          {
            name: "pa_auth_session",
            value: JSON.stringify(session),
          },
        ],
      },
      {
        origin: "http://localhost:7001",
        localStorage: [
          {
            name: "pa_auth_session",
            value: JSON.stringify(session),
          },
        ],
      },
    ],
  };

  const fixturesDir = path.resolve(".sandbox", "fixtures");
  await mkdir(fixturesDir, { recursive: true });
  const fixturePath = path.join(fixturesDir, "auth-state.json");
  await writeFile(fixturePath, JSON.stringify(storageState, null, 2), "utf8");
  console.log(`Saved storageState to ${fixturePath}`);
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});
