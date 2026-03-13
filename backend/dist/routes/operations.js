"use strict";
// backend/src/routes/operations.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationRoutes = operationRoutes;
const express_1 = require("express");
const bn_js_1 = __importDefault(require("bn.js"));
function operationRoutes(mintBurnService, indexer, solanaCtx, logger) {
    const router = (0, express_1.Router)();
    /**
     * POST /mint
     * Body: { recipient: string, amount: string, idempotencyKey?: string }
     *
     * Mints tokens to the recipient. Amount in smallest units.
     * Returns tx signature on success.
     */
    router.post("/mint", async (req, res) => {
        const { recipient, amount, idempotencyKey } = req.body;
        if (!recipient || !amount) {
            return res.status(400).json({ error: "Missing required fields: recipient, amount" });
        }
        const result = await mintBurnService.mint({
            recipient,
            amount,
            idempotencyKey,
        });
        res.status(result.status === "success" ? 200 : 400).json(result);
    });
    /**
     * POST /burn
     * Body: { amount: string, idempotencyKey?: string }
     *
     * Burns tokens from the backend's authority wallet.
     */
    router.post("/burn", async (req, res) => {
        const { amount, idempotencyKey } = req.body;
        if (!amount) {
            return res.status(400).json({ error: "Missing required field: amount" });
        }
        const result = await mintBurnService.burn({ amount, idempotencyKey });
        res.status(result.status === "success" ? 200 : 400).json(result);
    });
    /**
     * GET /supply
     * Returns current total supply.
     */
    router.get("/supply", async (_req, res) => {
        try {
            const supply = await mintBurnService.getSupply();
            res.json(supply);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /**
     * GET /status
     * Returns full stablecoin configuration and state.
     */
    router.get("/status", async (_req, res) => {
        try {
            const config = await solanaCtx.stablecoin.getConfig();
            const roles = await solanaCtx.stablecoin.getRoles();
            res.json({
                name: config.name,
                symbol: config.symbol,
                decimals: config.decimals,
                mint: config.mint.toBase58(),
                totalSupply: config.totalSupply.toString(),
                isPaused: config.isPaused,
                preset: solanaCtx.stablecoin.isCompliant ? "SSS-2" : "SSS-1",
                features: {
                    permanentDelegate: config.enablePermanentDelegate,
                    transferHook: config.enableTransferHook,
                    defaultAccountFrozen: config.defaultAccountFrozen,
                },
                authority: {
                    master: config.masterAuthority.toBase58(),
                    pendingTransfer: config.pendingMasterAuthority?.toBase58() ?? null,
                },
                roles: {
                    minters: roles.minters.map((m) => ({
                        address: m.address.toBase58(),
                        quota: m.quota.toString(),
                        minted: m.minted.toString(),
                        lastResetEpoch: m.lastResetEpoch.toString(),
                    })),
                    burners: roles.burners.map((b) => b.toBase58()),
                    pausers: roles.pausers.map((p) => p.toBase58()),
                    blacklisters: roles.blacklisters.map((b) => b.toBase58()),
                    seizers: roles.seizers.map((s) => s.toBase58()),
                },
                indexerStats: indexer.getStats(),
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /**
     * GET /holders?minBalance=1000000
     * Returns all token holders, optionally filtered by minimum balance.
     */
    router.get("/holders", async (req, res) => {
        try {
            const minBalance = req.query.minBalance
                ? new bn_js_1.default(req.query.minBalance)
                : undefined;
            const holders = await solanaCtx.stablecoin.getHolders(minBalance);
            res.json({
                count: holders.length,
                holders: holders.map((h) => ({
                    owner: h.owner.toBase58(),
                    tokenAccount: h.tokenAccount.toBase58(),
                    balance: h.balance.toString(),
                    isFrozen: h.isFrozen,
                })),
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /**
     * GET /events?name=TokensMinted&limit=50&offset=0
     * Returns indexed events from the in-memory store.
     */
    router.get("/events", (req, res) => {
        const events = indexer.getEvents({
            eventName: req.query.name,
            limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
            offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
        });
        res.json({
            count: events.length,
            stats: indexer.getStats(),
            events,
        });
    });
    return router;
}
