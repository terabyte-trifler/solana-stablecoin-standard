"use strict";
// backend/src/services/webhook.ts
//
// Sends event notifications to a configured webhook URL.
// Uses HMAC-SHA256 signature for verification.
// Exponential backoff retry (3 attempts by default).
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const crypto = __importStar(require("crypto"));
class WebhookService {
    constructor(config, logger) {
        this.url = config.webhookUrl;
        this.secret = config.webhookSecret;
        this.maxRetries = config.webhookMaxRetries;
        this.logger = logger.child({ service: "webhook" });
        if (this.url) {
            this.logger.info({ url: this.url }, "Webhook configured");
        }
        else {
            this.logger.info("No webhook URL configured — notifications disabled");
        }
    }
    /** Whether webhooks are configured and active. */
    get isConfigured() {
        return this.url !== null;
    }
    /**
     * Send an event to the webhook endpoint.
     * Non-blocking — fires and retries in background.
     */
    async send(event, data) {
        if (!this.url)
            return;
        const { v4: uuidv4 } = require("uuid");
        const payload = {
            id: uuidv4(),
            event,
            timestamp: new Date().toISOString(),
            data,
        };
        // Fire and forget — don't block the caller
        this._sendWithRetry(payload).catch((err) => {
            this.logger.error({ err, event, payloadId: payload.id }, "Webhook delivery failed after all retries");
        });
    }
    async _sendWithRetry(payload) {
        const body = JSON.stringify(payload);
        const signature = this._sign(body);
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(this.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-SSS-Signature": signature,
                        "X-SSS-Event": payload.event,
                        "X-SSS-Delivery": payload.id,
                    },
                    body,
                    signal: AbortSignal.timeout(10000), // 10s timeout
                });
                if (response.ok) {
                    this.logger.debug({ event: payload.event, id: payload.id, attempt }, "Webhook delivered");
                    return;
                }
                this.logger.warn({ status: response.status, attempt, event: payload.event }, "Webhook returned non-2xx");
            }
            catch (err) {
                this.logger.warn({ err: err.message, attempt, event: payload.event }, "Webhook request failed");
            }
            // Exponential backoff: 1s, 2s, 4s
            if (attempt < this.maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise((r) => setTimeout(r, delay));
            }
        }
        throw new Error(`Webhook delivery failed after ${this.maxRetries + 1} attempts`);
    }
    /** HMAC-SHA256 signature of the body using the webhook secret. */
    _sign(body) {
        if (!this.secret)
            return "unsigned";
        return crypto
            .createHmac("sha256", this.secret)
            .update(body)
            .digest("hex");
    }
}
exports.WebhookService = WebhookService;
