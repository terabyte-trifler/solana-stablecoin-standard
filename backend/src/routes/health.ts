// backend/src/routes/health.ts

import { Router, Request, Response } from "express";
import { SolanaContext } from "../utils/solana";
import { EventIndexer } from "../services/indexer";
import pino from "pino";

export function healthRoutes(
  solanaCtx: SolanaContext,
  indexer: EventIndexer,
  logger: pino.Logger
): Router {
  const router = Router();

  /**
   * GET /health
   *
   * Returns service health with component checks.
   * Returns 200 if healthy, 503 if degraded.
   */
  router.get("/health", async (_req: Request, res: Response) => {
    const checks: Record<string, { status: string; latency?: number; detail?: string }> = {};

    // Check Solana RPC
    const rpcStart = Date.now();
    try {
      const slot = await solanaCtx.connection.getSlot();
      checks.solanaRpc = {
        status: "ok",
        latency: Date.now() - rpcStart,
        detail: `slot ${slot}`,
      };
    } catch (err: any) {
      checks.solanaRpc = { status: "error", detail: err.message };
    }

    // Check stablecoin config readable
    try {
      const config = await solanaCtx.stablecoin.getConfig();
      checks.stablecoin = {
        status: "ok",
        detail: `${config.name} (${config.symbol}) — ${config.isPaused ? "PAUSED" : "active"}`,
      };
    } catch (err: any) {
      checks.stablecoin = { status: "error", detail: err.message };
    }

    // Indexer status
    checks.indexer = {
      status: "ok",
      detail: `${indexer.getStats().totalEvents} events indexed`,
    };

    // Authority configured?
    checks.authority = {
      status: solanaCtx.authority ? "ok" : "warn",
      detail: solanaCtx.authority
        ? `configured (${solanaCtx.authority.publicKey.toBase58().slice(0, 8)}...)`
        : "not configured — read-only mode",
    };

    const allOk = Object.values(checks).every((c) => c.status !== "error");

    res.status(allOk ? 200 : 503).json({
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  /**
   * GET /health/ready
   * Kubernetes readiness probe — returns 200 when ready to serve traffic.
   */
  router.get("/health/ready", async (_req: Request, res: Response) => {
    try {
      await solanaCtx.connection.getSlot();
      res.status(200).json({ ready: true });
    } catch {
      res.status(503).json({ ready: false });
    }
  });

  /**
   * GET /health/live
   * Kubernetes liveness probe — returns 200 if process is alive.
   */
  router.get("/health/live", (_req: Request, res: Response) => {
    res.status(200).json({ alive: true, uptime: process.uptime() });
  });

  return router;
}
