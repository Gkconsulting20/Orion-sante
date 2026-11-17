import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { randomUUID } from "node:crypto";

// Wrangler selects Pino's browser implementation on Workers. pino-http uses
// private Node-only Pino symbols, so use its public logger API on this target.
// The Node build continues using pino-http unchanged.
export default function workerHttpLogger({ logger }: { logger: Logger }): RequestHandler {
  return (req, res, next) => {
    const requestLogger = logger.child({
      req: { id: randomUUID(), method: req.method, url: req.originalUrl.split("?")[0] },
    });
    req.log = requestLogger;
    res.on("finish", () => {
      requestLogger.info({ res: { statusCode: res.statusCode } }, "request completed");
    });
    next();
  };
}
