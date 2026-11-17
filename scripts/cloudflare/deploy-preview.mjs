import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Upload a test version to the existing main Worker. Never deploy it or create a
// second Worker. The bindings file contains environment references, not values.
const root = fileURLToPath(new URL("../../", import.meta.url));
const required = ["ORION_PREVIEW_DATABASE_URL", "CLOUDFLARE_API_TOKEN", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing secret: ${key}`);
}
if (!process.env.CLERK_PUBLISHABLE_KEY.startsWith("pk_test_")) {
  throw new Error("This preview helper requires test Clerk keys; live keys require a separately approved configuration.");
}
const connection = new URL(process.env.ORION_PREVIEW_DATABASE_URL);
if (!connection.hostname.endsWith(".neon.tech")) {
  throw new Error("This preview helper is restricted to the selected existing Neon database.");
}
connection.searchParams.set("sslmode", "verify-full");

async function cloudflare(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!data.success || !response.ok) {
    throw new Error(`Cloudflare read check failed (${response.status}); no deployment attempted.`);
  }
  return data.result;
}
function run(args, extra = {}) {
  const result = spawnSync("pnpm", args, {
    cwd: root, stdio: "inherit", ...extra,
  });
  if (result.status !== 0) throw new Error(`Command failed: ${args.slice(0, 3).join(" ")} (exit ${result.status})`);
}

const accounts = await cloudflare("/accounts");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ??
  (accounts.length === 1 ? accounts[0].id : undefined);
if (!accountId || !accounts.some((account) => account.id === accountId)) {
  throw new Error("Select the intended Cloudflare account with CLOUDFLARE_ACCOUNT_ID.");
}
const target = "orion-sante";
const scriptPath = `/accounts/${accountId}/workers/scripts/${target}`;
// A missing Worker must fail, never create a substitute.
await cloudflare(`${scriptPath}/settings`);
const before = await cloudflare(`${scriptPath}/deployments`);
const domainBefore = await cloudflare(`${scriptPath}/subdomain`);
if (!domainBefore.previews_enabled) {
  await cloudflare(`${scriptPath}/subdomain`, {
    method: "POST",
    body: JSON.stringify({ enabled: domainBefore.enabled, previews_enabled: true }),
  });
}

const env = {
  ...process.env,
  CLOUDFLARE_ACCOUNT_ID: accountId,
  DATABASE_URL: connection.href,
  VITE_CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  WRANGLER_SEND_METRICS: "false",
};
delete env.VITE_CLERK_PROXY_URL;
run(["--filter", "@workspace/db", "exec", "node", "../../scripts/cloudflare/preflight.mjs"], {
  env: { ...env, DATABASE_URL: connection.href },
});
run(["run", "cf:build"], { env });
run(["--filter", "@workspace/api-server", "exec", "wrangler", "versions", "upload", "--env", "", "--preview-alias", "verification", "--secrets-file", "../../scripts/cloudflare/preview-secrets.env"], {
  env,
});
const after = await cloudflare(`${scriptPath}/deployments`);
const domainAfter = await cloudflare(`${scriptPath}/subdomain`);
if (JSON.stringify(before) !== JSON.stringify(after)) {
  throw new Error("Active deployment changed unexpectedly; inspect the main Worker before continuing.");
}
if (domainAfter.enabled !== domainBefore.enabled) {
  throw new Error("Main workers.dev availability changed unexpectedly; inspect its routing settings.");
}
console.info("Main Worker version uploaded. Active deployment unchanged; no production publication.");
