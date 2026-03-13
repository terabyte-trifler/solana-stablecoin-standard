"use strict";
// sdk/src/compliance.ts
//
// SSS-2 Compliance Module
//
// Provides blacklist management, token seizure, and audit trail querying.
// Only available on stablecoins created with SSS-2 features.
//
// Accessed via: stablecoin.compliance.blacklistAdd(...)
//
// ┌──────────────────────────────────────────────────────────────────┐
// │  OPERATIONS:                                                     │
// │                                                                  │
// │  blacklistAdd(address, reason, authority)                        │
// │    → Creates BlacklistEntry PDA                                  │
// │    → Transfer hook will block all future transfers               │
// │                                                                  │
// │  blacklistRemove(address, authority)                              │
// │    → Closes BlacklistEntry PDA                                   │
// │    → Address can transact again                                  │
// │                                                                  │
// │  isBlacklisted(address)                                          │
// │    → Returns true if BlacklistEntry PDA exists on-chain          │
// │                                                                  │
// │  getBlacklistEntry(address)                                      │
// │    → Returns full entry (reason, timestamp, who) or null         │
// │                                                                  │
// │  seize({ from, to, amount, authority })                          │
// │    → Transfers tokens via permanent delegate                     │
// │                                                                  │
// │  getAuditLog(filters?)                                           │
// │    → Parses program events from transaction history              │
// └──────────────────────────────────────────────────────────────────┘
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceModule = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const anchor_1 = require("@coral-xyz/anchor");
const pda_1 = require("./pda");
class ComplianceModule {
    constructor(connection, program, configPda, mint, roleManagerPda) {
        this.connection = connection;
        this.program = program;
        this.configPda = configPda;
        this.mint = mint;
        this.roleManagerPda = roleManagerPda;
    }
    // ================================================================
    // BLACKLIST MANAGEMENT
    // ================================================================
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
    async blacklistAdd(address, reason, authority) {
        const [blacklistEntryPda] = (0, pda_1.findBlacklistEntryPda)(this.configPda, address);
        return this.program.methods
            .addToBlacklist(address, reason)
            .accountsPartial({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
            blacklistEntry: blacklistEntryPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([authority])
            .rpc();
    }
    /**
     * Remove a wallet address from the blacklist.
     *
     * Closes the BlacklistEntry PDA and refunds rent to the authority.
     * The wallet can transact again immediately.
     *
     * @param address - Wallet owner address to unblacklist
     * @param authority - Blacklister or master authority keypair
     */
    async blacklistRemove(address, authority) {
        const [blacklistEntryPda] = (0, pda_1.findBlacklistEntryPda)(this.configPda, address);
        return this.program.methods
            .removeFromBlacklist(address)
            .accountsPartial({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
            blacklistEntry: blacklistEntryPda,
        })
            .signers([authority])
            .rpc();
    }
    /**
     * Check if a wallet address is currently blacklisted.
     *
     * This is a fast check — it only verifies whether the BlacklistEntry
     * PDA exists on-chain (no deserialization needed).
     *
     * @param address - Wallet owner address to check
     * @returns true if blacklisted, false otherwise
     */
    async isBlacklisted(address) {
        const [blacklistEntryPda] = (0, pda_1.findBlacklistEntryPda)(this.configPda, address);
        const accountInfo = await this.connection.getAccountInfo(blacklistEntryPda);
        // If the account exists and has data, the address is blacklisted
        return accountInfo !== null && accountInfo.data.length > 0;
    }
    /**
     * Get the full blacklist entry for a wallet address.
     *
     * Returns the reason, timestamp, and who blacklisted this address.
     * Returns null if the address is not blacklisted.
     *
     * @param address - Wallet owner address to look up
     */
    async getBlacklistEntry(address) {
        const [blacklistEntryPda] = (0, pda_1.findBlacklistEntryPda)(this.configPda, address);
        try {
            const raw = await this.program.account.blacklistEntry.fetch(blacklistEntryPda);
            return {
                stablecoin: raw.stablecoin,
                address: raw.address,
                reason: raw.reason,
                blacklistedAt: raw.blacklistedAt,
                blacklistedBy: raw.blacklistedBy,
                bump: raw.bump,
            };
        }
        catch {
            // Account doesn't exist or can't be deserialized
            return null;
        }
    }
    /**
     * Get all currently blacklisted addresses.
     *
     * Fetches all BlacklistEntry accounts for this stablecoin config.
     * Can be expensive for large blacklists — consider pagination for production.
     */
    async getAllBlacklisted() {
        const accounts = await this.program.account.blacklistEntry.all([
            {
                memcmp: {
                    offset: 8, // After Anchor discriminator
                    bytes: this.configPda.toBase58(),
                },
            },
        ]);
        return accounts.map(({ account: raw }) => ({
            stablecoin: raw.stablecoin,
            address: raw.address,
            reason: raw.reason,
            blacklistedAt: raw.blacklistedAt,
            blacklistedBy: raw.blacklistedBy,
            bump: raw.bump,
        }));
    }
    // ================================================================
    // SEIZURE
    // ================================================================
    /**
     * Seize tokens from any account via the permanent delegate.
     *
     * Transfers tokens from `from` to `to` without the owner's consent.
     * The config PDA acts as the permanent delegate.
     *
     * CRITICAL: On SSS-2 mints, Token-2022 requires the transfer hook's
     * extra accounts to be present on every transfer_checked call. This
     * method automatically resolves those accounts (ExtraAccountMetaList,
     * hook program, blacklist PDAs) and passes them as remainingAccounts.
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
    async seize(params) {
        // Resolve the transfer hook's extra accounts.
        // These are required by Token-2022 for any transfer_checked on
        // a mint with a TransferHook extension. Without them → 0xa261c2c0.
        const hookAccounts = await (0, pda_1.resolveTransferHookAccounts)(this.connection, this.mint, params.from, params.to, this.configPda);
        // Build instruction with base accounts + ExtraAccountMetaList.
        // The remaining 4 resolved metas (sss-token program, config, 2 blacklist PDAs)
        // are passed as remaining accounts.
        const ix = await this.program.methods
            .seize(params.amount)
            .accountsPartial({
            authority: params.authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
            mint: this.mint,
            sourceTokenAccount: params.from,
            destinationTokenAccount: params.to,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            extraAccountMetaList: hookAccounts[0].pubkey,
            transferHookProgram: hookAccounts[1].pubkey, // Kept for Anchor struct validation
            sssTokenProgram: hookAccounts[2].pubkey, // Kept for Anchor struct validation
        })
            .instruction();
        // Append config + blacklist PDAs as remaining accounts.
        // hookAccounts[0..2] are passed explicitly in accountsPartial:
        // [0] ExtraAccountMetaList, [1] hook program, [2] sss-token program.
        // So we start from [3]:
        // [3] config PDA, [4] source blacklist PDA, [5] dest blacklist PDA.
        for (let i = 3; i < hookAccounts.length; i++) {
            const acc = hookAccounts[i];
            ix.keys.push({
                pubkey: acc.pubkey,
                isSigner: acc.isSigner,
                isWritable: acc.isWritable,
            });
        }
        // Build and send the transaction
        const tx = new web3_js_1.Transaction().add(ix);
        const { blockhash } = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = params.authority.publicKey;
        tx.sign(params.authority);
        return await this.connection.sendRawTransaction(tx.serialize());
    }
    // ================================================================
    // AUDIT LOG
    // ================================================================
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
    async getAuditLog(filters) {
        const limit = filters?.limit ?? 100;
        // Fetch recent transaction signatures for the config account
        const signatures = await this.connection.getSignaturesForAddress(this.configPda, { limit });
        const events = [];
        for (const sigInfo of signatures) {
            // Apply slot filters
            if (filters?.afterSlot && sigInfo.slot <= filters.afterSlot)
                continue;
            if (filters?.beforeSlot && sigInfo.slot >= filters.beforeSlot)
                continue;
            try {
                const tx = await this.connection.getTransaction(sigInfo.signature, {
                    commitment: "confirmed",
                    maxSupportedTransactionVersion: 0,
                });
                if (!tx?.meta?.logMessages)
                    continue;
                // Parse Anchor events from logs
                const parsedEvents = this._parseEventsFromLogs(tx.meta.logMessages, sigInfo.signature, sigInfo.slot, sigInfo.blockTime ?? null);
                for (const event of parsedEvents) {
                    if (filters?.eventType && event.name !== filters.eventType)
                        continue;
                    events.push(event);
                }
            }
            catch {
                // Skip failed transaction fetches
                continue;
            }
        }
        return events;
    }
    /**
     * Export the audit log as a JSON-serializable array.
     * Useful for compliance reporting and external system integration.
     */
    async exportAuditLog(filters) {
        const events = await this.getAuditLog(filters);
        const serializable = events.map((e) => ({
            ...e,
            data: Object.fromEntries(Object.entries(e.data).map(([k, v]) => [
                k,
                v instanceof web3_js_1.PublicKey ? v.toBase58() : anchor_1.BN.isBN(v) ? v.toString() : v,
            ])),
        }));
        return JSON.stringify(serializable, null, 2);
    }
    // ================================================================
    // INTERNAL
    // ================================================================
    /**
     * Parse Anchor events from transaction log messages.
     *
     * Anchor events appear in logs as:
     *   Program data: <base64-encoded event>
     *
     * The first 8 bytes are the event discriminator (hash of event name).
     */
    _parseEventsFromLogs(logs, signature, slot, blockTime) {
        const events = [];
        const eventParser = this.program.coder.events;
        for (const log of logs) {
            if (!log.startsWith("Program data: "))
                continue;
            const data = log.slice("Program data: ".length);
            try {
                const decoded = eventParser.decode(data);
                if (decoded) {
                    events.push({
                        name: decoded.name,
                        data: decoded.data,
                        signature,
                        slot,
                        blockTime,
                    });
                }
            }
            catch {
                // Not an event we recognize — skip
            }
        }
        return events;
    }
}
exports.ComplianceModule = ComplianceModule;
//# sourceMappingURL=compliance.js.map