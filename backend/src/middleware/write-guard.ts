import { Request, Response, NextFunction } from "express";
import pino from "pino";
import { AppConfig } from "../config";

interface RateBucket {
  count: number;
  windowStart: number;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function createWriteGuard(config: AppConfig, logger: pino.Logger) {
  const buckets = new Map<string, RateBucket>();
  const log = logger.child({ service: "write-guard" });

  return (req: Request, res: Response, next: NextFunction) => {
    if (!WRITE_METHODS.has(req.method)) {
      return next();
    }

    if (config.apiKey) {
      const provided = req.header("x-api-key");
      if (!provided || provided !== config.apiKey) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart > config.writeRateLimitWindowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (bucket.count >= config.writeRateLimitMax) {
      log.warn({ ip: key, path: req.path }, "Write rate limit exceeded");
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    bucket.count += 1;
    return next();
  };
}
