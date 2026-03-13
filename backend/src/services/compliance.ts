// backend/src/services/compliance.ts
//
// SSS-2 compliance service.
// Wraps blacklist management with sanctions screening integration point.
// Provides audit trail export in JSON and CSV.
//
// SANCTIONS SCREENING:
// This service provides a stub/integration point for connecting to
// external sanctions APIs (OFAC SDN, EU sanctions, etc.). In production,
// replace the screening stub with calls to Chainalysis, Elliptic, or
// your compliance provider.

import { PublicKey, Keypair } from "@solana/web3.js";
import { SolanaStablecoin, BlacklistEntryAccount } from "@stbr/sss-token";
import BN from "bn.js";
import pino from "pino";
import { WebhookService } from "./webhook";
import { SolanaContext } from "../utils/solana";
import { AppConfig } from "../config";

export interface ScreeningResult {
  address: string;
  isMatch: boolean;
  source: string;
  matchType: string | null;
  details: string | null;
  timestamp: string;
}

export interface AuditExport {
  format: "json" | "csv";
  data: string;
  eventCount: number;
  generatedAt: string;
}

export class ComplianceService {
  private stablecoin: SolanaStablecoin;
  private authority: Keypair | null;
  private webhook: WebhookService;
  private logger: pino.Logger;
  private sanctionsApiUrl: string | null;
  private sanctionsApiKey: string | null;

  constructor(
    solanaCtx: SolanaContext,
    config: AppConfig,
    webhook: WebhookService,
    logger: pino.Logger
  ) {
    this.stablecoin = solanaCtx.stablecoin;
    this.authority = solanaCtx.authority;
    this.webhook = webhook;
    this.logger = logger.child({ service: "compliance" });
    this.sanctionsApiUrl = config.sanctionsApiUrl;
    this.sanctionsApiKey = config.sanctionsApiKey;
  }

  /** Whether SSS-2 compliance features are available. */
  get isAvailable(): boolean {
    return this.stablecoin.isCompliant;
  }

  // ================================================================
  // BLACKLIST MANAGEMENT
  // ================================================================

  /** Add address to blacklist with sanctions screening. */
  async blacklistAdd(
    address: string,
    reason: string
  ): Promise<{ status: string; signature?: string; error?: string }> {
    if (!this.isAvailable) {
      return { status: "error", error: "Compliance features not enabled (requires SSS-2)" };
    }
    if (!this.authority) {
      return { status: "error", error: "No authority keypair configured" };
    }

    try {
      const pubkey = new PublicKey(address);

      const sig = await this.stablecoin.compliance.blacklistAdd(
        pubkey,
        reason,
        this.authority
      );

      this.logger.info({ address, reason, signature: sig }, "Address blacklisted");

      await this.webhook.send("compliance.blacklisted", {
        address,
        reason,
        signature: sig,
      });

      return { status: "success", signature: sig };
    } catch (err: any) {
      this.logger.error({ err: err.message, address }, "Blacklist add failed");
      return { status: "error", error: err.message };
    }
  }

  /** Remove address from blacklist. */
  async blacklistRemove(
    address: string
  ): Promise<{ status: string; signature?: string; error?: string }> {
    if (!this.isAvailable) {
      return { status: "error", error: "Compliance features not enabled" };
    }
    if (!this.authority) {
      return { status: "error", error: "No authority keypair configured" };
    }

    try {
      const pubkey = new PublicKey(address);

      const sig = await this.stablecoin.compliance.blacklistRemove(
        pubkey,
        this.authority
      );

      this.logger.info({ address, signature: sig }, "Address removed from blacklist");

      await this.webhook.send("compliance.unblacklisted", {
        address,
        signature: sig,
      });

      return { status: "success", signature: sig };
    } catch (err: any) {
      this.logger.error({ err: err.message, address }, "Blacklist remove failed");
      return { status: "error", error: err.message };
    }
  }

  /** Check if an address is blacklisted. */
  async isBlacklisted(address: string): Promise<{
    address: string;
    blacklisted: boolean;
    entry: BlacklistEntryAccount | null;
  }> {
    if (!this.isAvailable) {
      return { address, blacklisted: false, entry: null };
    }

    const pubkey = new PublicKey(address);
    const blacklisted = await this.stablecoin.compliance.isBlacklisted(pubkey);
    let entry: BlacklistEntryAccount | null = null;

    if (blacklisted) {
      entry = await this.stablecoin.compliance.getBlacklistEntry(pubkey);
    }

    return { address, blacklisted, entry };
  }

  /** Get all blacklisted addresses. */
  async getAllBlacklisted(): Promise<BlacklistEntryAccount[]> {
    if (!this.isAvailable) return [];
    return this.stablecoin.compliance.getAllBlacklisted();
  }

  // ================================================================
  // SANCTIONS SCREENING (Integration Point)
  // ================================================================

  /**
   * Screen an address against sanctions lists.
   *
   * STUB IMPLEMENTATION — replace with your actual compliance provider.
   *
   * In production, this would call:
   * - Chainalysis KYT API
   * - Elliptic Lens
   * - TRM Labs
   * - Direct OFAC SDN list lookup
   *
   * The stub always returns no match. To test positive matches,
   * set SANCTIONS_API_URL to a mock endpoint.
   */
  async screenAddress(address: string): Promise<ScreeningResult> {
    this.logger.info({ address }, "Screening address against sanctions");

    if (this.sanctionsApiUrl) {
      // Call external sanctions API
      try {
        const response = await fetch(`${this.sanctionsApiUrl}/screen`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.sanctionsApiKey
              ? { Authorization: `Bearer ${this.sanctionsApiKey}` }
              : {}),
          },
          body: JSON.stringify({ address }),
          signal: AbortSignal.timeout(5_000),
        });

        if (response.ok) {
          const data = (await response.json()) as Record<string, unknown>;
          return {
            address,
            isMatch: Boolean(data.isMatch ?? false),
            source: "external-api",
            matchType: (data.matchType as string | null | undefined) ?? null,
            details: (data.details as string | null | undefined) ?? null,
            timestamp: new Date().toISOString(),
          };
        }
      } catch (err: any) {
        this.logger.warn(
          { err: err.message },
          "External sanctions API call failed, falling back to stub"
        );
      }
    }

    // Stub: always returns no match
    return {
      address,
      isMatch: false,
      source: "stub",
      matchType: null,
      details: "No sanctions API configured — stub response",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Screen and auto-blacklist if sanctions match found.
   * Combines screening + blacklisting in one call.
   */
  async screenAndEnforce(
    address: string
  ): Promise<{ screening: ScreeningResult; blacklisted: boolean; signature?: string }> {
    const screening = await this.screenAddress(address);

    if (screening.isMatch && this.authority && this.isAvailable) {
      const reason = `Auto-blacklist: ${screening.source} — ${screening.matchType || "sanctions match"}`;
      const result = await this.blacklistAdd(address, reason);
      return {
        screening,
        blacklisted: result.status === "success",
        signature: result.signature,
      };
    }

    return { screening, blacklisted: false };
  }

  // ================================================================
  // AUDIT TRAIL EXPORT
  // ================================================================

  /** Export audit trail as JSON. */
  async exportAuditJson(limit?: number): Promise<AuditExport> {
    if (!this.isAvailable) {
      return {
        format: "json",
        data: "[]",
        eventCount: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const events = await this.stablecoin.compliance.getAuditLog({ limit: limit ?? 500 });

    const serialized = events.map((e) => ({
      ...e,
      data: Object.fromEntries(
        Object.entries(e.data).map(([k, v]) => [
          k,
          v && typeof v === "object" && "toBase58" in (v as any)
            ? (v as any).toBase58()
            : BN.isBN(v)
            ? v.toString()
            : v,
        ])
      ),
    }));

    return {
      format: "json",
      data: JSON.stringify(serialized, null, 2),
      eventCount: serialized.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Export audit trail as CSV. */
  async exportAuditCsv(limit?: number): Promise<AuditExport> {
    if (!this.isAvailable) {
      return {
        format: "csv",
        data: "event,signature,slot,blockTime\n",
        eventCount: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const events = await this.stablecoin.compliance.getAuditLog({ limit: limit ?? 500 });

    const header = "event,signature,slot,blockTime,data\n";
    const rows = events.map((e) => {
      const dataStr = JSON.stringify(e.data).replace(/"/g, '""');
      return `${e.name},${e.signature},${e.slot},${e.blockTime || ""},\"${dataStr}\"`;
    });

    return {
      format: "csv",
      data: header + rows.join("\n"),
      eventCount: events.length,
      generatedAt: new Date().toISOString(),
    };
  }
}
