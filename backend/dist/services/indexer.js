"use strict";
// backend/src/services/indexer.ts
//
// Real-time on-chain event listener.
// Subscribes to program logs via WebSocket and parses Anchor events.
// Maintains in-memory event store for fast API queries.
// Triggers webhook notifications for each event.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventIndexer = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class EventIndexer {
    constructor(solanaCtx, config, webhook, logger) {
        this.events = [];
        this.eventCounter = 0;
        this.subscriptionId = null;
        // In-memory aggregates for fast reads
        this.stats = {
            totalMinted: new anchor_1.BN(0),
            totalBurned: new anchor_1.BN(0),
            mintCount: 0,
            burnCount: 0,
            freezeCount: 0,
            blacklistCount: 0,
            seizeCount: 0,
        };
        this.connection = solanaCtx.connection;
        this.programId = solanaCtx.stablecoin.program.programId;
        this.program = solanaCtx.stablecoin.program;
        this.webhook = webhook;
        this.logger = logger.child({ service: "indexer" });
        this.statePath = config.indexerStatePath;
    }
    /** Start listening for on-chain events. */
    async start() {
        this._loadState();
        this.logger.info({ programId: this.programId.toBase58() }, "Starting event indexer");
        this.subscriptionId = this.connection.onLogs(this.programId, (logs) => {
            this._processLogs(logs).catch((err) => {
                this.logger.error({ err }, "Error processing logs");
            });
        }, "confirmed");
        this.logger.info({ subscriptionId: this.subscriptionId }, "Event indexer subscribed");
    }
    /** Stop listening. */
    async stop() {
        this._persistState();
        if (this.subscriptionId !== null) {
            await this.connection.removeOnLogsListener(this.subscriptionId);
            this.logger.info("Event indexer stopped");
            this.subscriptionId = null;
        }
    }
    /** Get all indexed events, optionally filtered. */
    getEvents(filter) {
        let result = this.events;
        if (filter?.eventName) {
            result = result.filter((e) => e.name === filter.eventName);
        }
        // Newest first
        result = [...result].reverse();
        const offset = filter?.offset ?? 0;
        const limit = filter?.limit ?? 100;
        return result.slice(offset, offset + limit);
    }
    /** Get aggregate stats. */
    getStats() {
        return {
            ...this.stats,
            totalMinted: this.stats.totalMinted.toString(),
            totalBurned: this.stats.totalBurned.toString(),
            totalEvents: this.events.length,
        };
    }
    /** Process a log entry from the subscription. */
    async _processLogs(logs) {
        if (logs.err)
            return; // Skip failed transactions
        const eventParser = this.program.coder.events;
        for (const log of logs.logs) {
            if (!log.startsWith("Program data: "))
                continue;
            const data = log.slice("Program data: ".length);
            try {
                const decoded = eventParser.decode(data);
                if (!decoded)
                    continue;
                const event = {
                    id: ++this.eventCounter,
                    name: decoded.name,
                    data: this._serializeEventData(decoded.data),
                    signature: logs.signature,
                    slot: 0, // Slot not available from onLogs
                    timestamp: new Date().toISOString(),
                };
                this.events.push(event);
                this._updateStats(decoded.name, decoded.data);
                this._persistState();
                this.logger.info({ event: decoded.name, tx: logs.signature.slice(0, 16) + "..." }, "Event indexed");
                // Fire webhook
                await this.webhook.send(decoded.name, event.data);
                // Cap in-memory events at 10,000
                if (this.events.length > 10000) {
                    this.events = this.events.slice(-5000);
                }
            }
            catch {
                // Not an event we recognize
            }
        }
    }
    /** Update aggregate stats from a parsed event. */
    _updateStats(name, data) {
        switch (name) {
            case "TokensMinted":
                this.stats.totalMinted = this.stats.totalMinted.add(data.amount);
                this.stats.mintCount++;
                break;
            case "TokensBurned":
                this.stats.totalBurned = this.stats.totalBurned.add(data.amount);
                this.stats.burnCount++;
                break;
            case "AccountFrozen":
                this.stats.freezeCount++;
                break;
            case "AddressBlacklisted":
                this.stats.blacklistCount++;
                break;
            case "TokensSeized":
                this.stats.seizeCount++;
                break;
        }
    }
    /** Convert BN and PublicKey fields to strings for JSON. */
    _serializeEventData(data) {
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            if (anchor_1.BN.isBN(value)) {
                result[key] = value.toString();
            }
            else if (value && typeof value === "object" && "toBase58" in value) {
                result[key] = value.toBase58();
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    _persistState() {
        try {
            const parent = path_1.default.dirname(this.statePath);
            fs_1.default.mkdirSync(parent, { recursive: true });
            const payload = {
                eventCounter: this.eventCounter,
                events: this.events,
                stats: {
                    ...this.stats,
                    totalMinted: this.stats.totalMinted.toString(),
                    totalBurned: this.stats.totalBurned.toString(),
                },
            };
            fs_1.default.writeFileSync(this.statePath, JSON.stringify(payload));
        }
        catch (err) {
            this.logger.warn({ err: err.message }, "Failed to persist indexer state");
        }
    }
    _loadState() {
        try {
            if (!fs_1.default.existsSync(this.statePath)) {
                return;
            }
            const raw = JSON.parse(fs_1.default.readFileSync(this.statePath, "utf-8"));
            this.eventCounter = raw.eventCounter ?? 0;
            this.events = raw.events ?? [];
            if (raw.stats) {
                this.stats.totalMinted = new anchor_1.BN(raw.stats.totalMinted ?? "0");
                this.stats.totalBurned = new anchor_1.BN(raw.stats.totalBurned ?? "0");
                this.stats.mintCount = raw.stats.mintCount ?? 0;
                this.stats.burnCount = raw.stats.burnCount ?? 0;
                this.stats.freezeCount = raw.stats.freezeCount ?? 0;
                this.stats.blacklistCount = raw.stats.blacklistCount ?? 0;
                this.stats.seizeCount = raw.stats.seizeCount ?? 0;
            }
            this.logger.info({ events: this.events.length, path: this.statePath }, "Loaded indexer state from disk");
        }
        catch (err) {
            this.logger.warn({ err: err.message }, "Failed to load indexer state");
        }
    }
}
exports.EventIndexer = EventIndexer;
