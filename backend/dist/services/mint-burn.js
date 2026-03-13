"use strict";
// backend/src/services/mint-burn.ts
//
// Coordinates the fiat-to-stablecoin lifecycle.
// Provides a request-based API on top of the SDK's direct operations.
//
// Flow:
//   1. Receive request (recipient, amount, idempotency key)
//   2. Validate minter authorization
//   3. Execute on-chain mint/burn via SDK
//   4. Log the result
//   5. Trigger webhook
//   6. Return tx signature + status
//
// Idempotency: duplicate requests with the same key return the cached result.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MintBurnService = void 0;
const web3_js_1 = require("@solana/web3.js");
const bn_js_1 = __importDefault(require("bn.js"));
class MintBurnService {
    constructor(solanaCtx, webhook, logger) {
        this.decimals = 6;
        // Idempotency cache: key → result
        this.cache = new Map();
        this.stablecoin = solanaCtx.stablecoin;
        this.authority = solanaCtx.authority;
        this.webhook = webhook;
        this.logger = logger.child({ service: "mint-burn" });
    }
    async initialize() {
        const config = await this.stablecoin.getConfig();
        this.decimals = config.decimals;
        this.logger.info({ decimals: this.decimals }, "Mint/burn service ready");
    }
    async mint(req) {
        // Idempotency check
        if (req.idempotencyKey && this.cache.has(req.idempotencyKey)) {
            this.logger.info({ key: req.idempotencyKey }, "Returning cached mint result");
            return this.cache.get(req.idempotencyKey);
        }
        if (!this.authority) {
            return this._error("No authority keypair configured — cannot mint");
        }
        this.logger.info({ recipient: req.recipient, amount: req.amount }, "Processing mint request");
        try {
            const recipient = new web3_js_1.PublicKey(req.recipient);
            const amount = new bn_js_1.default(req.amount);
            if (amount.isZero() || amount.isNeg()) {
                return this._error("Amount must be positive");
            }
            const sig = await this.stablecoin.mintTokens({
                recipient,
                amount,
                minter: this.authority,
            });
            const result = {
                status: "success",
                signature: sig,
                amount: req.amount,
                timestamp: new Date().toISOString(),
            };
            this.logger.info({ signature: sig, amount: req.amount }, "Mint successful");
            // Cache for idempotency
            if (req.idempotencyKey) {
                this.cache.set(req.idempotencyKey, result);
            }
            // Webhook
            await this.webhook.send("mint.completed", {
                signature: sig,
                recipient: req.recipient,
                amount: req.amount,
            });
            return result;
        }
        catch (err) {
            this.logger.error({ err: err.message }, "Mint failed");
            await this.webhook.send("mint.failed", {
                recipient: req.recipient,
                amount: req.amount,
                error: err.message,
            });
            return this._error(err.message);
        }
    }
    async burn(req) {
        if (req.idempotencyKey && this.cache.has(req.idempotencyKey)) {
            return this.cache.get(req.idempotencyKey);
        }
        if (!this.authority) {
            return this._error("No authority keypair configured — cannot burn");
        }
        this.logger.info({ amount: req.amount }, "Processing burn request");
        try {
            const amount = new bn_js_1.default(req.amount);
            if (amount.isZero() || amount.isNeg()) {
                return this._error("Amount must be positive");
            }
            const sig = await this.stablecoin.burn({
                amount,
                burner: this.authority,
            });
            const result = {
                status: "success",
                signature: sig,
                amount: req.amount,
                timestamp: new Date().toISOString(),
            };
            this.logger.info({ signature: sig, amount: req.amount }, "Burn successful");
            if (req.idempotencyKey) {
                this.cache.set(req.idempotencyKey, result);
            }
            await this.webhook.send("burn.completed", {
                signature: sig,
                amount: req.amount,
            });
            return result;
        }
        catch (err) {
            this.logger.error({ err: err.message }, "Burn failed");
            await this.webhook.send("burn.failed", {
                amount: req.amount,
                error: err.message,
            });
            return this._error(err.message);
        }
    }
    /** Get current total supply from chain. */
    async getSupply() {
        const supply = await this.stablecoin.getTotalSupply();
        return { totalSupply: supply.toString(), decimals: this.decimals };
    }
    _error(message) {
        return {
            status: "error",
            error: message,
            amount: "0",
            timestamp: new Date().toISOString(),
        };
    }
}
exports.MintBurnService = MintBurnService;
