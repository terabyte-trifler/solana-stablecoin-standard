import { BlacklistEntryAccount } from "@stbr/sss-token";
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
export declare class ComplianceService {
    private stablecoin;
    private authority;
    private webhook;
    private logger;
    private sanctionsApiUrl;
    private sanctionsApiKey;
    constructor(solanaCtx: SolanaContext, config: AppConfig, webhook: WebhookService, logger: pino.Logger);
    /** Whether SSS-2 compliance features are available. */
    get isAvailable(): boolean;
    /** Add address to blacklist with sanctions screening. */
    blacklistAdd(address: string, reason: string): Promise<{
        status: string;
        signature?: string;
        error?: string;
    }>;
    /** Remove address from blacklist. */
    blacklistRemove(address: string): Promise<{
        status: string;
        signature?: string;
        error?: string;
    }>;
    /** Check if an address is blacklisted. */
    isBlacklisted(address: string): Promise<{
        address: string;
        blacklisted: boolean;
        entry: BlacklistEntryAccount | null;
    }>;
    /** Get all blacklisted addresses. */
    getAllBlacklisted(): Promise<BlacklistEntryAccount[]>;
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
    screenAddress(address: string): Promise<ScreeningResult>;
    /**
     * Screen and auto-blacklist if sanctions match found.
     * Combines screening + blacklisting in one call.
     */
    screenAndEnforce(address: string): Promise<{
        screening: ScreeningResult;
        blacklisted: boolean;
        signature?: string;
    }>;
    /** Export audit trail as JSON. */
    exportAuditJson(limit?: number): Promise<AuditExport>;
    /** Export audit trail as CSV. */
    exportAuditCsv(limit?: number): Promise<AuditExport>;
}
