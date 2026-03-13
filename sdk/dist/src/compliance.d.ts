import { Connection, Keypair, PublicKey, TransactionSignature } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { SeizeParams, BlacklistEntryAccount, AuditLogFilters, AuditEvent } from "./types";
import type { SssToken } from "../idl/sss_token";
export declare class ComplianceModule {
    private readonly connection;
    private readonly program;
    private readonly configPda;
    private readonly mint;
    private readonly roleManagerPda;
    constructor(connection: Connection, program: Program<SssToken>, configPda: PublicKey, mint: PublicKey, roleManagerPda: PublicKey);
    /**
     * Add a wallet address to the blacklist.
     *
     * Creates a BlacklistEntry PDA. Once created, the transfer hook will
     * reject all transfers involving this wallet (both send and receive).
     *
     * The authority must be the master authority or a registered blacklister.
     * ALLOWED while paused.
     *
     * @param address - Wallet owner address to blacklist (NOT a token account)
     * @param reason - Compliance reason (1–100 bytes, e.g., "OFAC SDN match")
     * @param authority - Blacklister or master authority keypair
     * @returns Transaction signature
     *
     * @example
     * ```ts
     * await stable.compliance.blacklistAdd(
     *   suspectWallet,
     *   "OFAC SDN match — list update 2025-03-01",
     *   blacklisterKeypair
     * );
     * ```
     */
    blacklistAdd(address: PublicKey, reason: string, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Remove a wallet address from the blacklist.
     *
     * Closes the BlacklistEntry PDA and refunds rent to the authority.
     * The wallet can transact again immediately.
     *
     * @param address - Wallet owner address to unblacklist
     * @param authority - Blacklister or master authority keypair
     */
    blacklistRemove(address: PublicKey, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Check if a wallet address is currently blacklisted.
     *
     * This is a fast check — it only verifies whether the BlacklistEntry
     * PDA exists on-chain (no deserialization needed).
     *
     * @param address - Wallet owner address to check
     * @returns true if blacklisted, false otherwise
     */
    isBlacklisted(address: PublicKey): Promise<boolean>;
    /**
     * Get the full blacklist entry for a wallet address.
     *
     * Returns the reason, timestamp, and who blacklisted this address.
     * Returns null if the address is not blacklisted.
     *
     * @param address - Wallet owner address to look up
     */
    getBlacklistEntry(address: PublicKey): Promise<BlacklistEntryAccount | null>;
    /**
     * Get all currently blacklisted addresses.
     *
     * Fetches all BlacklistEntry accounts for this stablecoin config.
     * Can be expensive for large blacklists — consider pagination for production.
     */
    getAllBlacklisted(): Promise<BlacklistEntryAccount[]>;
    /**
     * Seize tokens from any account via the permanent delegate.
     *
     * Transfers tokens from `from` to `to` without the owner's consent.
     * The config PDA acts as the permanent delegate.
     *
     * Policy:
     * - Partial seizure is supported (specify exact amount)
     * - Source account does NOT need to be frozen first
     * - Destination can be any token account for the same mint
     * - Can seize from any account, not just blacklisted ones
     *
     * ALLOWED while paused.
     *
     * @param params - Seizure parameters (from, to, amount, authority)
     *
     * @example
     * ```ts
     * await stable.compliance.seize({
     *   from: suspectTokenAccount,
     *   to: treasuryTokenAccount,
     *   amount: new BN(1_000_000_000), // 1000 MYUSD
     *   authority: seizerKeypair,
     * });
     * ```
     */
    seize(params: SeizeParams): Promise<TransactionSignature>;
    /**
     * Query the on-chain audit log (parsed program events).
     *
     * Reads transaction history for the config PDA and parses Anchor
     * events from the logs. This provides a complete compliance audit trail.
     *
     * Note: This queries Solana's transaction history, which has retention
     * limits on some RPC providers. For production, use a dedicated indexer.
     *
     * @param filters - Optional filters (event type, slot range, limit)
     */
    getAuditLog(filters?: AuditLogFilters): Promise<AuditEvent[]>;
    /**
     * Export the audit log as a JSON-serializable array.
     * Useful for compliance reporting and external system integration.
     */
    exportAuditLog(filters?: AuditLogFilters): Promise<string>;
    /**
     * Parse Anchor events from transaction log messages.
     *
     * Anchor events appear in logs as:
     *   Program data: <base64-encoded event>
     *
     * The first 8 bytes are the event discriminator (hash of event name).
     */
    private _parseEventsFromLogs;
}
//# sourceMappingURL=compliance.d.ts.map