"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const solana_1 = require("./utils/solana");
const webhook_1 = require("./services/webhook");
const indexer_1 = require("./services/indexer");
const mint_burn_1 = require("./services/mint-burn");
const compliance_1 = require("./services/compliance");
const health_1 = require("./routes/health");
const operations_1 = require("./routes/operations");
const compliance_2 = require("./routes/compliance");
const write_guard_1 = require("./middleware/write-guard");
async function main() {
    // ── 1. Config ──────────────────────────────────────────────────
    const config = (0, config_1.loadConfig)();
    const logger = (0, logger_1.createLogger)(config.logLevel);
    logger.info("Starting SSS Backend...");
    // ── 2–3. Solana connection + SDK ───────────────────────────────
    let solanaCtx;
    try {
        solanaCtx = await (0, solana_1.initSolana)(config, logger);
    }
    catch (err) {
        logger.fatal({ err: err.message }, "Failed to connect to Solana");
        process.exit(1);
    }
    // ── 4. Initialize services ─────────────────────────────────────
    const webhook = new webhook_1.WebhookService(config, logger);
    const indexer = new indexer_1.EventIndexer(solanaCtx, config, webhook, logger);
    const mintBurnService = new mint_burn_1.MintBurnService(solanaCtx, webhook, logger);
    await mintBurnService.initialize();
    const complianceService = new compliance_1.ComplianceService(solanaCtx, config, webhook, logger);
    // ── 5. Express app ─────────────────────────────────────────────
    const app = (0, express_1.default)();
    // Security middleware
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use("/api", (0, write_guard_1.createWriteGuard)(config, logger));
    // Request logging
    app.use((req, _res, next) => {
        if (req.path !== "/health/live" && req.path !== "/health/ready") {
            logger.debug({ method: req.method, path: req.path }, "Request");
        }
        next();
    });
    // ── 6. Register routes ─────────────────────────────────────────
    app.use("/", (0, health_1.healthRoutes)(solanaCtx, indexer, logger));
    app.use("/api", (0, operations_1.operationRoutes)(mintBurnService, indexer, solanaCtx, logger));
    app.use("/api", (0, compliance_2.complianceRoutes)(complianceService, logger));
    // 404 handler
    app.use((_req, res) => {
        res.status(404).json({ error: "Not found" });
    });
    // Error handler
    app.use((err, _req, res, _next) => {
        logger.error({ err: err.message }, "Unhandled error");
        res.status(500).json({ error: "Internal server error" });
    });
    // ── 7. Start server ────────────────────────────────────────────
    const server = app.listen(config.port, config.host, () => {
        logger.info({ host: config.host, port: config.port }, "SSS Backend listening");
    });
    // ── 8. Start event indexer ─────────────────────────────────────
    await indexer.start();
    // ── Graceful shutdown ──────────────────────────────────────────
    const shutdown = async (signal) => {
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
        }, 10000);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}
main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
