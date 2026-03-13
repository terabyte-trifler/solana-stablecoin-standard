import { Connection, Keypair, PublicKey, TransactionSignature } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { StablecoinCreateOptions, StablecoinConfigAccount, RoleManagerAccount, MintParams, BurnParams, HolderInfo, RoleType } from "./types";
import { ComplianceModule } from "./compliance";
import type { SssToken } from "../idl/sss_token";
type SssTokenProgram = Program<SssToken>;
/**
 * The main SDK class for interacting with a Solana Stablecoin Standard instance.
 *
 * Supports both SSS-1 (minimal) and SSS-2 (compliant) stablecoins.
 * SSS-2 features are accessed via the `.compliance` property.
 */
export declare class SolanaStablecoin {
    /** Solana connection. */
    readonly connection: Connection;
    /** Anchor program instance for sss-token. */
    readonly program: SssTokenProgram;
    /** The StablecoinConfig PDA address. */
    readonly configPda: PublicKey;
    /** The Token-2022 mint address. */
    readonly mint: PublicKey;
    /** The RoleManager PDA address. */
    readonly roleManagerPda: PublicKey;
    private _compliance;
    private _cachedConfig;
    private constructor();
    /**
     * Access SSS-2 compliance features (blacklist, seize, audit).
     * Throws if the stablecoin was created without compliance extensions.
     */
    get compliance(): ComplianceModule;
    /** Whether this instance has SSS-2 compliance features enabled. */
    get isCompliant(): boolean;
    /**
     * Create a new stablecoin instance.
     *
     * This sends two transactions (or one if SSS-1):
     * 1. `initialize` — creates mint + config + roles
     * 2. `init_hook_accounts` — sets up transfer hook meta list (SSS-2 only)
     *
     * @param connection - Solana RPC connection
     * @param opts - Creation options (preset, name, symbol, etc.)
     * @returns A configured SolanaStablecoin instance
     *
     * @example
     * ```ts
     * const stable = await SolanaStablecoin.create(connection, {
     *   preset: "SSS_2",
     *   name: "Compliance USD",
     *   symbol: "CUSD",
     *   decimals: 6,
     *   authority: adminKeypair,
     * });
     * ```
     */
    static create(connection: Connection, opts: StablecoinCreateOptions): Promise<SolanaStablecoin>;
    /**
     * Load an existing stablecoin from its config PDA address.
     *
     * Fetches the on-chain config to determine the mint and whether
     * compliance features are enabled.
     *
     * @param connection - Solana RPC connection
     * @param configPda - The StablecoinConfig PDA address
     * @param wallet - Optional wallet for signing (defaults to read-only)
     */
    static load(connection: Connection, configPda: PublicKey, wallet?: Keypair): Promise<SolanaStablecoin>;
    /**
     * Mint new tokens to a recipient.
     *
     * The signer must be the master authority or a registered minter.
     * If the recipient doesn't have a token account, the SDK creates
     * an Associated Token Account (ATA) automatically.
     *
     * BLOCKED while paused.
     */
    mintTokens(params: MintParams): Promise<TransactionSignature>;
    /**
     * Burn tokens from the signer's token account.
     *
     * BLOCKED while paused.
     */
    burn(params: BurnParams): Promise<TransactionSignature>;
    /**
     * Freeze a token account. Master authority only.
     * ALLOWED while paused.
     *
     * @param tokenAccount - The token account to freeze
     * @param authority - The master authority keypair
     */
    freezeAccount(tokenAccount: PublicKey, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Thaw a frozen token account. Master authority only.
     * ALLOWED while paused.
     */
    thawAccount(tokenAccount: PublicKey, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Pause all mint/burn operations.
     * Signer must be master authority or registered pauser.
     */
    pause(authority: Keypair): Promise<TransactionSignature>;
    /**
     * Unpause operations. Master authority ONLY.
     */
    unpause(authority: Keypair): Promise<TransactionSignature>;
    /**
     * Add a new minter with per-epoch quota.
     * Master authority only. Allowed while paused.
     *
     * @param minter - Address to grant minter role
     * @param quota - Max tokens per epoch (BN(0) = unlimited)
     * @param authority - Master authority keypair
     */
    addMinter(minter: PublicKey, quota: BN, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Remove a minter.
     */
    removeMinter(minter: PublicKey, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Update a minter's per-epoch quota.
     */
    updateMinterQuota(minter: PublicKey, newQuota: BN, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Grant a role (burner, pauser, blacklister, seizer) to an address.
     * Master authority only. Allowed while paused.
     * Blacklister/seizer require SSS-2.
     */
    grantRole(role: RoleType, grantee: PublicKey, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Revoke a role from an address.
     */
    revokeRole(role: RoleType, revokee: PublicKey, authority: Keypair): Promise<TransactionSignature>;
    /**
     * Propose transferring master authority to a new address (step 1).
     * Current master authority signs.
     */
    transferAuthority(newAuthority: PublicKey, currentAuthority: Keypair): Promise<TransactionSignature>;
    /**
     * Accept a pending authority transfer (step 2).
     * The new authority signs.
     */
    acceptAuthority(newAuthority: Keypair): Promise<TransactionSignature>;
    /**
     * Cancel a pending authority transfer.
     * Current master authority signs.
     */
    cancelAuthorityTransfer(authority: Keypair): Promise<TransactionSignature>;
    /**
     * Get the current total supply.
     * Reads from StablecoinConfig (fast, no mint deserialization needed).
     */
    getTotalSupply(): Promise<BN>;
    /**
     * Fetch and parse the StablecoinConfig account.
     * Caches the result; call `refreshConfig()` to force re-fetch.
     */
    getConfig(): Promise<StablecoinConfigAccount>;
    /** Force re-fetch config from chain. */
    refreshConfig(): Promise<StablecoinConfigAccount>;
    /**
     * Fetch and parse the RoleManager account.
     */
    getRoles(): Promise<RoleManagerAccount>;
    /**
     * Get all token holders for this stablecoin.
     *
     * Uses `getProgramAccounts` with filters to find all Token-2022
     * accounts for this mint.
     *
     * @param minBalance - Only return holders with at least this balance
     */
    getHolders(minBalance?: BN): Promise<HolderInfo[]>;
    /**
     * Check if this stablecoin is currently paused.
     */
    isPaused(): Promise<boolean>;
    /** Convert SDK RoleType enum to Anchor's on-chain enum format. */
    private _toOnChainRoleType;
    /** Parse raw Anchor account data into typed StablecoinConfigAccount. */
    private _parseConfig;
    /** Parse raw Anchor account data into typed RoleManagerAccount. */
    private _parseRoles;
}
export {};
//# sourceMappingURL=stablecoin.d.ts.map