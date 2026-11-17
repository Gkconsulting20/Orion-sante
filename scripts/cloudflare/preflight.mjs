import { createRequire } from "node:module";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
const { default: pg } = await import(createRequire(new URL("../../lib/db/package.json", import.meta.url)).resolve("pg"));

// Deliberately print neither the URL, hostname, credentials nor raw errors.
function privateAddress(address) {
  return /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address) ||
    address === "::1" || /^(fc|fd|fe80:)/i.test(address);
}

let pool;
try {
  if (!process.env.DATABASE_URL) throw new Error("missing");
  const url = new URL(process.env.DATABASE_URL);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
  const publicHost = addresses.length > 0 && addresses.every(({ address }) => !privateAddress(address));
  console.info(`PostgreSQL network: ${publicHost ? "public DNS/IP (remote access still unverified)" : "private/local; not reachable directly from Cloudflare"}`);
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT to_regclass('public.clinics') IS NOT NULL AS schema_ready");
    // pg_stat_ssl describes the pooler → PostgreSQL hop, not our TLS connection
    // to Neon. Inspect the actual negotiated client transport instead.
    const tls = client.connection.stream.encrypted === true;
    console.info(`SQL connection: OK; schema: ${rows[0].schema_ready ? "OK" : "missing"}; client TLS: ${tls ? "enabled" : "disabled"}`);
    if (!publicHost || !rows[0].schema_ready || !tls) process.exitCode = 1;
  } finally {
    client.release();
  }
} catch {
  console.error("PostgreSQL preflight failed; check the secure connection settings. No credentials printed.");
  process.exitCode = 1;
} finally {
  await pool?.end();
}
