import { handleAsNodeRequest } from "cloudflare:node";
import { withRequestDatabase } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

for (const key of ["DATABASE_URL", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing Worker secret: ${key}`);
}

// A Workers routing key, not a TCP listener exposed to the network.
app.listen(3000);

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    // Do not trust forwarded headers supplied by a client. The public URL is
    // authoritative on Workers, unlike the upstream proxy used in Replit.
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", url.protocol.slice(0, -1));
    headers.delete("x-forwarded-for");
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers.set("x-forwarded-for", ip);
    const forwarded = new Request(request, { headers });

    try {
      return await withRequestDatabase(process.env.DATABASE_URL!, () =>
        handleAsNodeRequest(3000, forwarded),
      );
    } catch {
      // Never log a driver error here: it can include connection credentials.
      logger.error("Worker request failed");
      return Response.json(
        { error: "Service temporairement indisponible." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
};
