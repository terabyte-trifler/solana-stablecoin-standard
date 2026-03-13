import pino from "pino";
import { AppConfig } from "../config";
export interface WebhookPayload {
    id: string;
    event: string;
    timestamp: string;
    data: Record<string, unknown>;
}
export declare class WebhookService {
    private url;
    private secret;
    private maxRetries;
    private logger;
    constructor(config: AppConfig, logger: pino.Logger);
    /** Whether webhooks are configured and active. */
    get isConfigured(): boolean;
    /**
     * Send an event to the webhook endpoint.
     * Non-blocking — fires and retries in background.
     */
    send(event: string, data: Record<string, unknown>): Promise<void>;
    private _sendWithRetry;
    /** HMAC-SHA256 signature of the body using the webhook secret. */
    private _sign;
}
