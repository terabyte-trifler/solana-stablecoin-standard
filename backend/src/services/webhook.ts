// backend/src/services/webhook.ts
//
// Sends event notifications to a configured webhook URL.
// Uses HMAC-SHA256 signature for verification.
// Exponential backoff retry (3 attempts by default).

import * as crypto from "crypto";
import pino from "pino";
import { AppConfig } from "../config";

export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export class WebhookService {
  private url: string | null;
  private secret: string | null;
  private maxRetries: number;
  private logger: pino.Logger;

  constructor(config: AppConfig, logger: pino.Logger) {
    this.url = config.webhookUrl;
    this.secret = config.webhookSecret;
    this.maxRetries = config.webhookMaxRetries;
    this.logger = logger.child({ service: "webhook" });

    if (this.url) {
      this.logger.info({ url: this.url }, "Webhook configured");
    } else {
      this.logger.info("No webhook URL configured — notifications disabled");
    }
  }

  /** Whether webhooks are configured and active. */
  get isConfigured(): boolean {
    return this.url !== null;
  }

  /**
   * Send an event to the webhook endpoint.
   * Non-blocking — fires and retries in background.
   */
  async send(event: string, data: Record<string, unknown>): Promise<void> {
    if (!this.url) return;

    const { v4: uuidv4 } = require("uuid");
    const payload: WebhookPayload = {
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

  private async _sendWithRetry(payload: WebhookPayload): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = this._sign(body);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.url!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SSS-Signature": signature,
            "X-SSS-Event": payload.event,
            "X-SSS-Delivery": payload.id,
          },
          body,
          signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        if (response.ok) {
          this.logger.debug(
            { event: payload.event, id: payload.id, attempt },
            "Webhook delivered"
          );
          return;
        }

        this.logger.warn(
          { status: response.status, attempt, event: payload.event },
          "Webhook returned non-2xx"
        );
      } catch (err: any) {
        this.logger.warn(
          { err: err.message, attempt, event: payload.event },
          "Webhook request failed"
        );
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
  private _sign(body: string): string {
    if (!this.secret) return "unsigned";
    return crypto
      .createHmac("sha256", this.secret)
      .update(body)
      .digest("hex");
  }
}
