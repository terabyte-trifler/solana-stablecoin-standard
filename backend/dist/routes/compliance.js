"use strict";
// backend/src/routes/compliance.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.complianceRoutes = complianceRoutes;
const express_1 = require("express");
function complianceRoutes(complianceService, logger) {
    const router = (0, express_1.Router)();
    /**
     * POST /blacklist
     * Body: { address: string, reason: string }
     *
     * Add a wallet address to the blacklist.
     */
    router.post("/blacklist", async (req, res) => {
        const { address, reason } = req.body;
        if (!address || !reason) {
            return res.status(400).json({ error: "Missing required fields: address, reason" });
        }
        const result = await complianceService.blacklistAdd(address, reason);
        res.status(result.status === "success" ? 200 : 400).json(result);
    });
    /**
     * DELETE /blacklist/:address
     *
     * Remove a wallet address from the blacklist.
     */
    router.delete("/blacklist/:address", async (req, res) => {
        const result = await complianceService.blacklistRemove(req.params.address);
        res.status(result.status === "success" ? 200 : 400).json(result);
    });
    /**
     * GET /blacklist/:address
     *
     * Check if a specific address is blacklisted.
     * Returns blacklist entry details if found.
     */
    router.get("/blacklist/:address", async (req, res) => {
        try {
            const result = await complianceService.isBlacklisted(req.params.address);
            res.json({
                address: result.address,
                blacklisted: result.blacklisted,
                entry: result.entry
                    ? {
                        reason: result.entry.reason,
                        blacklistedAt: result.entry.blacklistedAt.toString(),
                        blacklistedBy: result.entry.blacklistedBy.toBase58(),
                    }
                    : null,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /**
     * GET /blacklist
     *
     * List all blacklisted addresses.
     */
    router.get("/blacklist", async (_req, res) => {
        try {
            const entries = await complianceService.getAllBlacklisted();
            res.json({
                count: entries.length,
                entries: entries.map((e) => ({
                    address: e.address.toBase58(),
                    reason: e.reason,
                    blacklistedAt: e.blacklistedAt.toString(),
                    blacklistedBy: e.blacklistedBy.toBase58(),
                })),
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /**
     * POST /screen
     * Body: { address: string }
     *
     * Screen an address against sanctions lists.
     * Optionally auto-blacklists if a match is found (if autoEnforce=true).
     */
    router.post("/screen", async (req, res) => {
        const { address, autoEnforce } = req.body;
        if (!address) {
            return res.status(400).json({ error: "Missing required field: address" });
        }
        try {
            if (autoEnforce) {
                const result = await complianceService.screenAndEnforce(address);
                return res.json(result);
            }
            const screening = await complianceService.screenAddress(address);
            res.json(screening);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /**
     * GET /audit?format=json&limit=100
     *
     * Export the on-chain audit trail.
     * Supports JSON and CSV formats.
     */
    router.get("/audit", async (req, res) => {
        try {
            const format = req.query.format || "json";
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
            if (format === "csv") {
                const result = await complianceService.exportAuditCsv(limit);
                res.setHeader("Content-Type", "text/csv");
                res.setHeader("Content-Disposition", `attachment; filename=audit-${Date.now()}.csv`);
                return res.send(result.data);
            }
            const result = await complianceService.exportAuditJson(limit);
            res.json({
                eventCount: result.eventCount,
                generatedAt: result.generatedAt,
                events: JSON.parse(result.data),
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
