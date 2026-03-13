// backend/src/main.ts
//
// ┌──────────────────────────────────────────────────────────────────┐
// │                    SSS Backend Server                            │
// │                                                                  │
// │  Express server that provides:                                   │
// │  - REST API for mint/burn operations                            │
// │  - Real-time event indexing via WebSocket subscription          │
// │  - Compliance endpoints (blacklist, screening, audit)           │
// │  - Health checks for monitoring                                  │
// │  - Webhook notifications for all events                         │
// │                                                                  │
// │  Startup order:                                                  │
// │  1. Load config from env vars                                   │
// │  2. Connect to Solana RPC                                       │
// │  3. Load stablecoin SDK instance                                │
// │  4. Initialize services (webhook, indexer, mint-burn, compliance)│
// │  5. Register routes                                              │
// │  6. Start HTTP server                                           │
// │  7. Start event indexer subscription                            │
// └──────────────────────────────────────────────────────────────────┘

import express from "express";
import helmet from "helmet";
import cors from "cors";

import { loadConfig } from "./config";
import { createLogger } from "./utils/logger";
import { initSolana, SolanaContext } from "./utils/solana";
import { WebhookService } from "./services/webhook";
import { EventIndexer } from "./services/indexer";
import { MintBurnService } from "./services/mint-burn";
import { ComplianceService } from "./services/compliance";
import { healthRoutes } from "./routes/health";
import { operationRoutes } from "./routes/operations";
import { complianceRoutes } from "./routes/compliance";
import { createWriteGuard } from "./middleware/write-guard";

async function main(): Promise<void> {
  // ── 1. Config ──────────────────────────────────────────────────
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info("Starting SSS Backend...");

  // ── 2–3. Solana connection + SDK ───────────────────────────────
  let solanaCtx: SolanaContext;
  try {
    solanaCtx = await initSolana(config, logger);
  } catch (err: any) {
    logger.fatal({ err: err.message }, "Failed to connect to Solana");
    process.exit(1);
  }

  // ── 4. Initialize services ─────────────────────────────────────
  const webhook = new WebhookService(config, logger);

  const indexer = new EventIndexer(solanaCtx, config, webhook, logger);

  const mintBurnService = new MintBurnService(solanaCtx, webhook, logger);
  await mintBurnService.initialize();

  const complianceService = new ComplianceService(
    solanaCtx,
    config,
    webhook,
    logger,
  );

  // ── 5. Express app ─────────────────────────────────────────────
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createWriteGuard(config, logger));

  // Request logging
  app.use((req, _res, next) => {
    if (req.path !== "/health/live" && req.path !== "/health/ready") {
      logger.debug({ method: req.method, path: req.path }, "Request");
    }
    next();
  });

  // ── 6. Register routes ─────────────────────────────────────────
  app.use("/", healthRoutes(solanaCtx, indexer, logger));
  app.use("/api", operationRoutes(mintBurnService, indexer, solanaCtx, logger));
  app.use("/api", complianceRoutes(complianceService, logger));

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error({ err: err.message }, "Unhandled error");
      res.status(500).json({ error: "Internal server error" });
    },
  );

  // ── 7. Start server ────────────────────────────────────────────
  const server = app.listen(config.port, config.host, () => {
    logger.info(
      { host: config.host, port: config.port },
      "SSS Backend listening",
    );
  });

  // ── 8. Start event indexer ─────────────────────────────────────
  await indexer.start();

  // ── Graceful shutdown ──────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");

    await indexer.stop();

    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      logger.warn("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
