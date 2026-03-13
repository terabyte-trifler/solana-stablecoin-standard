"use strict";
// backend/src/routes/health.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const express_1 = require("express");
function healthRoutes(solanaCtx, indexer, logger) {
    const router = (0, express_1.Router)();
    /**
     * GET /health
     *
     * Returns service health with component checks.
     * Returns 200 if healthy, 503 if degraded.
     */
    router.get("/health", async (_req, res) => {
        const checks = {};
        // Check Solana RPC
        const rpcStart = Date.now();
        try {
            const slot = await solanaCtx.connection.getSlot();
            checks.solanaRpc = {
                status: "ok",
                latency: Date.now() - rpcStart,
                detail: `slot ${slot}`,
            };
        }
        catch (err) {
            checks.solanaRpc = { status: "error", detail: err.message };
        }
        // Check stablecoin config readable
        try {
            const config = await solanaCtx.stablecoin.getConfig();
            checks.stablecoin = {
                status: "ok",
                detail: `${config.name} (${config.symbol}) — ${config.isPaused ? "PAUSED" : "active"}`,
            };
        }
        catch (err) {
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
    router.get("/health/ready", async (_req, res) => {
        try {
            await solanaCtx.connection.getSlot();
            res.status(200).json({ ready: true });
        }
        catch {
            res.status(503).json({ ready: false });
        }
    });
    /**
     * GET /health/live
     * Kubernetes liveness probe — returns 200 if process is alive.
     */
    router.get("/health/live", (_req, res) => {
        res.status(200).json({ alive: true, uptime: process.uptime() });
    });
    return router;
}
