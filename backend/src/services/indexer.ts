// backend/src/services/indexer.ts
//
// Real-time on-chain event listener.
// Subscribes to program logs via WebSocket and parses Anchor events.
// Maintains in-memory event store for fast API queries.
// Triggers webhook notifications for each event.

import { Connection, PublicKey, Logs } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import pino from "pino";
import { WebhookService } from "./webhook";
import { SolanaContext } from "../utils/solana";
import { AppConfig } from "../config";
import fs from "fs";
import path from "path";

/** A stored event with metadata. */
export interface IndexedEvent {
  id: number;
  name: string;
  data: Record<string, unknown>;
  signature: string;
  slot: number;
  timestamp: string;
}

export class EventIndexer {
  private logger: pino.Logger;
  private connection: Connection;
  private programId: PublicKey;
  private webhook: WebhookService;
  private events: IndexedEvent[] = [];
  private eventCounter = 0;
  private subscriptionId: number | null = null;
  private program: Program<any>;
  private statePath: string;

  // In-memory aggregates for fast reads
  private stats = {
    totalMinted: new BN(0),
    totalBurned: new BN(0),
    mintCount: 0,
    burnCount: 0,
    freezeCount: 0,
    blacklistCount: 0,
    seizeCount: 0,
  };

  constructor(
    solanaCtx: SolanaContext,
    config: AppConfig,
    webhook: WebhookService,
    logger: pino.Logger
  ) {
    this.connection = solanaCtx.connection;
    this.programId = solanaCtx.stablecoin.program.programId;
    this.program = solanaCtx.stablecoin.program;
    this.webhook = webhook;
    this.logger = logger.child({ service: "indexer" });
    this.statePath = config.indexerStatePath;
  }

  /** Start listening for on-chain events. */
  async start(): Promise<void> {
    this._loadState();
    this.logger.info(
      { programId: this.programId.toBase58() },
      "Starting event indexer"
    );

    this.subscriptionId = this.connection.onLogs(
      this.programId,
      (logs: Logs) => {
        this._processLogs(logs).catch((err) => {
          this.logger.error({ err }, "Error processing logs");
        });
      },
      "confirmed"
    );

    this.logger.info(
      { subscriptionId: this.subscriptionId },
      "Event indexer subscribed"
    );
  }

  /** Stop listening. */
  async stop(): Promise<void> {
    this._persistState();
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.logger.info("Event indexer stopped");
      this.subscriptionId = null;
    }
  }

  /** Get all indexed events, optionally filtered. */
  getEvents(filter?: {
    eventName?: string;
    limit?: number;
    offset?: number;
  }): IndexedEvent[] {
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
  private async _processLogs(logs: Logs): Promise<void> {
    if (logs.err) return; // Skip failed transactions

    const eventParser = this.program.coder.events;

    for (const log of logs.logs) {
      if (!log.startsWith("Program data: ")) continue;

      const data = log.slice("Program data: ".length);
      try {
        const decoded = eventParser.decode(data);
        if (!decoded) continue;

        const event: IndexedEvent = {
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

        this.logger.info(
          { event: decoded.name, tx: logs.signature.slice(0, 16) + "..." },
          "Event indexed"
        );

        // Fire webhook
        await this.webhook.send(decoded.name, event.data);

        // Cap in-memory events at 10,000
        if (this.events.length > 10_000) {
          this.events = this.events.slice(-5_000);
        }
      } catch {
        // Not an event we recognize
      }
    }
  }

  /** Update aggregate stats from a parsed event. */
  private _updateStats(name: string, data: any): void {
    switch (name) {
      case "TokensMinted":
        this.stats.totalMinted = this.stats.totalMinted.add(
          data.amount as BN
        );
        this.stats.mintCount++;
        break;
      case "TokensBurned":
        this.stats.totalBurned = this.stats.totalBurned.add(
          data.amount as BN
        );
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
  private _serializeEventData(data: any): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (BN.isBN(value)) {
        result[key] = (value as BN).toString();
      } else if (value && typeof value === "object" && "toBase58" in value) {
        result[key] = (value as PublicKey).toBase58();
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private _persistState(): void {
    try {
      const parent = path.dirname(this.statePath);
      fs.mkdirSync(parent, { recursive: true });
      const payload = {
        eventCounter: this.eventCounter,
        events: this.events,
        stats: {
          ...this.stats,
          totalMinted: this.stats.totalMinted.toString(),
          totalBurned: this.stats.totalBurned.toString(),
        },
      };
      fs.writeFileSync(this.statePath, JSON.stringify(payload));
    } catch (err: any) {
      this.logger.warn({ err: err.message }, "Failed to persist indexer state");
    }
  }

  private _loadState(): void {
    try {
      if (!fs.existsSync(this.statePath)) {
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.statePath, "utf-8")) as {
        eventCounter?: number;
        events?: IndexedEvent[];
        stats?: {
          totalMinted?: string;
          totalBurned?: string;
          mintCount?: number;
          burnCount?: number;
          freezeCount?: number;
          blacklistCount?: number;
          seizeCount?: number;
        };
      };
      this.eventCounter = raw.eventCounter ?? 0;
      this.events = raw.events ?? [];
      if (raw.stats) {
        this.stats.totalMinted = new BN(raw.stats.totalMinted ?? "0");
        this.stats.totalBurned = new BN(raw.stats.totalBurned ?? "0");
        this.stats.mintCount = raw.stats.mintCount ?? 0;
        this.stats.burnCount = raw.stats.burnCount ?? 0;
        this.stats.freezeCount = raw.stats.freezeCount ?? 0;
        this.stats.blacklistCount = raw.stats.blacklistCount ?? 0;
        this.stats.seizeCount = raw.stats.seizeCount ?? 0;
      }
      this.logger.info(
        { events: this.events.length, path: this.statePath },
        "Loaded indexer state from disk"
      );
    } catch (err: any) {
      this.logger.warn({ err: err.message }, "Failed to load indexer state");
    }
  }
}
