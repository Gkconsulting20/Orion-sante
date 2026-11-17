import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from "miniflare";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { smoke } from "../../../scripts/cloudflare/smoke.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const bindings = { NODE_ENV: "production", LOG_LEVEL: "silent", CLERK_USE_CONFIGURED_KEY: "true" };
for (const key of ["DATABASE_URL", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
  bindings[key] = process.env[key];
}
const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{
    name: "orion-test",
    modules: true,
    modulesRoot: root,
    scriptPath: path.join(root, "generated-artifacts/cloudflare/worker.js"),
    compatibilityDate: "2026-11-13",
    compatibilityFlags: ["nodejs_compat"],
    bindings,
  }],
  log: new Log(LogLevel.ERROR),
}));
try {
  await smoke("https://orion-preview.test", (url, init) => mf.dispatchFetch(url.href, init));
} finally {
  await mf.dispose();
}
