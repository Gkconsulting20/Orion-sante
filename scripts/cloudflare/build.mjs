import { spawnSync } from "node:child_process";

if (!process.env.VITE_CLERK_PUBLISHABLE_KEY) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required in the build environment.");
}
const result = spawnSync("pnpm", ["--filter", "@workspace/orion-sante", "run", "build"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/", VITE_CLERK_USE_CONFIGURED_KEY: "true" },
});
process.exit(result.status ?? 1);
