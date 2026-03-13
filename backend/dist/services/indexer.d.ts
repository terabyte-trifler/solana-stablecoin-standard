import pino from "pino";
import { WebhookService } from "./webhook";
import { SolanaContext } from "../utils/solana";
import { AppConfig } from "../config";
/** A stored event with metadata. */
export interface IndexedEvent {
    id: number;
    name: string;
    data: Record<string, unknown>;
    signature: string;
    slot: number;
    timestamp: string;
}
export declare class EventIndexer {
    private logger;
    private connection;
    private programId;
    private webhook;
    private events;
    private eventCounter;
    private subscriptionId;
    private program;
    private statePath;
    private stats;
    constructor(solanaCtx: SolanaContext, config: AppConfig, webhook: WebhookService, logger: pino.Logger);
    /** Start listening for on-chain events. */
    start(): Promise<void>;
    /** Stop listening. */
    stop(): Promise<void>;
    /** Get all indexed events, optionally filtered. */
    getEvents(filter?: {
        eventName?: string;
        limit?: number;
        offset?: number;
    }): IndexedEvent[];
    /** Get aggregate stats. */
    getStats(): {
        totalMinted: string;
        totalBurned: string;
        totalEvents: number;
        mintCount: number;
        burnCount: number;
        freezeCount: number;
        blacklistCount: number;
        seizeCount: number;
    };
    /** Process a log entry from the subscription. */
    private _processLogs;
    /** Update aggregate stats from a parsed event. */
    private _updateStats;
    /** Convert BN and PublicKey fields to strings for JSON. */
    private _serializeEventData;
    private _persistState;
    private _loadState;
}
