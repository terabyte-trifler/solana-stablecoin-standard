"use strict";
// sdk/src/stablecoin.ts
//
// ┌──────────────────────────────────────────────────────────────────┐
// │                    SolanaStablecoin                              │
// │                                                                  │
// │  The primary SDK entry point. Wraps every on-chain instruction  │
// │  with a clean async API.                                        │
// │                                                                  │
// │  Usage:                                                          │
// │    // Create new SSS-2 stablecoin                               │
// │    const stable = await SolanaStablecoin.create(connection, {   │
// │      preset: "SSS_2",                                           │
// │      name: "My Stablecoin",                                     │
// │      symbol: "MYUSD",                                           │
// │      authority: adminKeypair,                                   │
// │    });                                                           │
// │                                                                  │
// │    // Mint tokens                                                │
// │    await stable.mint({ recipient, amount, minter });            │
// │                                                                  │
// │    // SSS-2 compliance                                          │
// │    await stable.compliance.blacklistAdd(address, "OFAC", auth); │
// │    await stable.compliance.seize({ from, to, amount, auth });   │
// │                                                                  │
// │    // Load existing                                              │
// │    const loaded = await SolanaStablecoin.load(conn, configPda); │
// └──────────────────────────────────────────────────────────────────┘
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaStablecoin = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const anchor_1 = require("@coral-xyz/anchor");
const types_1 = require("./types");
const presets_1 = require("./presets");
const pda_1 = require("./pda");
const compliance_1 = require("./compliance");
const sss_token_json_1 = __importDefault(require("../idl/sss_token.json"));
/**
 * The main SDK class for interacting with a Solana Stablecoin Standard instance.
 *
 * Supports both SSS-1 (minimal) and SSS-2 (compliant) stablecoins.
 * SSS-2 features are accessed via the `.compliance` property.
 */
class SolanaStablecoin {
    constructor(connection, program, configPda, mint, roleManagerPda, isCompliant) {
        this._compliance = null;
        this._cachedConfig = null;
        this.connection = connection;
        this.program = program;
        this.configPda = configPda;
        this.mint = mint;
        this.roleManagerPda = roleManagerPda;
        if (isCompliant) {
            this._compliance = new compliance_1.ComplianceModule(connection, program, configPda, mint, roleManagerPda);
        }
    }
    // ================================================================
    // COMPLIANCE MODULE (SSS-2)
    // ================================================================
    /**
     * Access SSS-2 compliance features (blacklist, seize, audit).
     * Throws if the stablecoin was created without compliance extensions.
     */
    get compliance() {
        if (!this._compliance) {
            throw new Error("Compliance module not available. " +
                "This stablecoin was created without SSS-2 features " +
                "(enablePermanentDelegate + enableTransferHook). " +
                "Use preset: 'SSS_2' when creating to enable compliance.");
        }
        return this._compliance;
    }
    /** Whether this instance has SSS-2 compliance features enabled. */
    get isCompliant() {
        return this._compliance !== null;
    }
    // ================================================================
    // STATIC FACTORY: CREATE
    // ================================================================
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
    static async create(connection, opts) {
        const features = (0, presets_1.resolveFeatures)(opts);
        const decimals = opts.decimals ?? 6;
        const uri = opts.uri ?? "";
        // Generate a fresh keypair for the mint
        const mintKeypair = web3_js_1.Keypair.generate();
        const mint = mintKeypair.publicKey;
        // Derive PDAs
        const [configPda] = (0, pda_1.findStablecoinConfigPda)(mint);
        const [roleManagerPda] = (0, pda_1.findRoleManagerPda)(configPda);
        // Build provider and program
        const provider = new anchor_1.AnchorProvider(connection, new anchor_1.Wallet(opts.authority), anchor_1.AnchorProvider.defaultOptions());
        const program = new anchor_1.Program(sss_token_json_1.default, provider);
        // ── Transaction 1: Initialize ──────────────────────────────
        const initTx = await program.methods
            .initialize(opts.name, opts.symbol, uri, decimals, features.enablePermanentDelegate, features.enableTransferHook, features.defaultAccountFrozen)
            .accounts({
            payer: opts.authority.publicKey,
            mint: mint,
            stablecoinConfig: configPda,
            roleManager: roleManagerPda,
            tokenProgram: pda_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
            rent: web3_js_1.SYSVAR_RENT_PUBKEY,
        })
            .signers([opts.authority, mintKeypair])
            .rpc();
        // Wait for transaction confirmation to ensure account is readable
        await connection.confirmTransaction(initTx, "confirmed");
        await new Promise((resolve) => setTimeout(resolve, 500));
        // ── Transaction 2: Init hook accounts (SSS-2 only) ─────────
        if (features.enableTransferHook) {
            const [extraMetaListPda] = (0, pda_1.findExtraAccountMetaListPda)(mint);
            await program.methods
                .initHookAccounts()
                .accounts({
                payer: opts.authority.publicKey,
                stablecoinConfig: configPda,
                mint: mint,
                extraAccountMetaList: extraMetaListPda,
                hookProgram: pda_1.SSS_TRANSFER_HOOK_PROGRAM_ID,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([opts.authority])
                .rpc();
        }
        const isCompliant = features.enablePermanentDelegate && features.enableTransferHook;
        return new SolanaStablecoin(connection, program, configPda, mint, roleManagerPda, isCompliant);
    }
    // ================================================================
    // STATIC FACTORY: LOAD
    // ================================================================
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
    static async load(connection, configPda, wallet) {
        // Create a lightweight read-only wallet for cases where no wallet is provided
        // This allows read operations without requiring ANCHOR_WALLET env var
        const readOnlyWallet = {
            publicKey: wallet?.publicKey ?? web3_js_1.Keypair.generate().publicKey,
            async signTransaction(tx) {
                return tx;
            },
            async signAllTransactions(txs) {
                return txs;
            },
        };
        const provider = new anchor_1.AnchorProvider(connection, wallet ? new anchor_1.Wallet(wallet) : readOnlyWallet, anchor_1.AnchorProvider.defaultOptions());
        const program = new anchor_1.Program(sss_token_json_1.default, provider);
        // Fetch config from chain
        const config = await program.account.stablecoinConfig.fetch(configPda);
        const mint = config.mint;
        const [roleManagerPda] = (0, pda_1.findRoleManagerPda)(configPda);
        const isCompliant = config.enablePermanentDelegate &&
            config.enableTransferHook;
        return new SolanaStablecoin(connection, program, configPda, mint, roleManagerPda, isCompliant);
    }
    // ================================================================
    // CORE OPERATIONS
    // ================================================================
    /**
     * Mint new tokens to a recipient.
     *
     * The signer must be the master authority or a registered minter.
     * If the recipient doesn't have a token account, the SDK creates
     * an Associated Token Account (ATA) automatically.
     *
     * BLOCKED while paused.
     */
    async mintTokens(params) {
        // Resolve recipient's token account (create ATA if needed)
        const recipientAta = (0, spl_token_1.getAssociatedTokenAddressSync)(this.mint, params.recipient, true, pda_1.TOKEN_2022_PROGRAM_ID);
        // Check if the ATA exists; if not, prepend create instruction
        const ataInfo = await this.connection.getAccountInfo(recipientAta);
        const builder = this.program.methods
            .mintTokens(params.amount)
            .accounts({
            authority: params.minter.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
            mint: this.mint,
            recipientTokenAccount: recipientAta,
            tokenProgram: pda_1.TOKEN_2022_PROGRAM_ID,
        })
            .signers([params.minter]);
        if (!ataInfo) {
            // Prepend ATA creation
            builder.preInstructions([
                (0, spl_token_1.createAssociatedTokenAccountInstruction)(params.minter.publicKey, // payer
                recipientAta, params.recipient, // owner
                this.mint, pda_1.TOKEN_2022_PROGRAM_ID),
            ]);
        }
        return builder.rpc();
    }
    /**
     * Burn tokens from the signer's token account.
     *
     * BLOCKED while paused.
     */
    async burn(params) {
        const tokenAccount = params.tokenAccount ??
            (0, spl_token_1.getAssociatedTokenAddressSync)(this.mint, params.burner.publicKey, true, pda_1.TOKEN_2022_PROGRAM_ID);
        return this.program.methods
            .burnTokens(params.amount)
            .accounts({
            authority: params.burner.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
            mint: this.mint,
            tokenAccount: tokenAccount,
            tokenProgram: pda_1.TOKEN_2022_PROGRAM_ID,
        })
            .signers([params.burner])
            .rpc();
    }
    /**
     * Freeze a token account. Master authority only.
     * ALLOWED while paused.
     *
     * @param tokenAccount - The token account to freeze
     * @param authority - The master authority keypair
     */
    async freezeAccount(tokenAccount, authority) {
        return this.program.methods
            .freezeAccount()
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            mint: this.mint,
            tokenAccount: tokenAccount,
            tokenProgram: pda_1.TOKEN_2022_PROGRAM_ID,
        })
            .signers([authority])
            .rpc();
    }
    /**
     * Thaw a frozen token account. Master authority only.
     * ALLOWED while paused.
     */
    async thawAccount(tokenAccount, authority) {
        return this.program.methods
            .thawAccount()
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            mint: this.mint,
            tokenAccount: tokenAccount,
            tokenProgram: pda_1.TOKEN_2022_PROGRAM_ID,
        })
            .signers([authority])
            .rpc();
    }
    /**
     * Pause all mint/burn operations.
     * Signer must be master authority or registered pauser.
     */
    async pause(authority) {
        return this.program.methods
            .pause()
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
        })
            .signers([authority])
            .rpc();
    }
    /**
     * Unpause operations. Master authority ONLY.
     */
    async unpause(authority) {
        return this.program.methods
            .unpause()
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
        })
            .signers([authority])
            .rpc();
    }
    // ================================================================
    // MINTER MANAGEMENT
    // ================================================================
    /**
     * Add a new minter with per-epoch quota.
     * Master authority only. Allowed while paused.
     *
     * @param minter - Address to grant minter role
     * @param quota - Max tokens per epoch (BN(0) = unlimited)
     * @param authority - Master authority keypair
     */
    async addMinter(minter, quota, authority) {
        return this.program.methods
            .addMinter(minter, quota)
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
        })
            .signers([authority])
            .rpc();
    }
    /**
     * Remove a minter.
     */
    async removeMinter(minter, authority) {
        return this.program.methods
            .removeMinter(minter)
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
        })
            .signers([authority])
            .rpc();
    }
    /**
     * Update a minter's per-epoch quota.
     */
    async updateMinterQuota(minter, newQuota, authority) {
        return this.program.methods
            .updateMinterQuota(minter, newQuota)
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
        })
            .signers([authority])
            .rpc();
    }
    // ================================================================
    // ROLE MANAGEMENT
    // ================================================================
    /**
     * Grant a role (burner, pauser, blacklister, seizer) to an address.
     * Master authority only. Allowed while paused.
     * Blacklister/seizer require SSS-2.
     */
    async grantRole(role, grantee, authority) {
        const roleArg = this._toOnChainRoleType(role);
        return this.program.methods
            .grantRole(roleArg, grantee)
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
        })
            .signers([authority])
            .rpc();
    }
    /**
     * Revoke a role from an address.
     */
    async revokeRole(role, revokee, authority) {
        const roleArg = this._toOnChainRoleType(role);
        return this.program.methods
            .revokeRole(roleArg, revokee)
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
            roleManager: this.roleManagerPda,
        })
            .signers([authority])
            .rpc();
    }
    // ================================================================
    // AUTHORITY TRANSFER (Two-step)
    // ================================================================
    /**
     * Propose transferring master authority to a new address (step 1).
     * Current master authority signs.
     */
    async transferAuthority(newAuthority, currentAuthority) {
        return this.program.methods
            .transferAuthority(newAuthority)
            .accounts({
            authority: currentAuthority.publicKey,
            stablecoinConfig: this.configPda,
        })
            .signers([currentAuthority])
            .rpc();
    }
    /**
     * Accept a pending authority transfer (step 2).
     * The new authority signs.
     */
    async acceptAuthority(newAuthority) {
        return this.program.methods
            .acceptAuthority()
            .accounts({
            newAuthority: newAuthority.publicKey,
            stablecoinConfig: this.configPda,
        })
            .signers([newAuthority])
            .rpc();
    }
    /**
     * Cancel a pending authority transfer.
     * Current master authority signs.
     */
    async cancelAuthorityTransfer(authority) {
        return this.program.methods
            .cancelAuthorityTransfer()
            .accounts({
            authority: authority.publicKey,
            stablecoinConfig: this.configPda,
        })
            .signers([authority])
            .rpc();
    }
    // ================================================================
    // READ OPERATIONS
    // ================================================================
    /**
     * Get the current total supply.
     * Reads from StablecoinConfig (fast, no mint deserialization needed).
     */
    async getTotalSupply() {
        const config = await this.getConfig();
        return config.totalSupply;
    }
    /**
     * Fetch and parse the StablecoinConfig account.
     * Caches the result; call `refreshConfig()` to force re-fetch.
     */
    async getConfig() {
        const raw = await this.program.account.stablecoinConfig.fetch(this.configPda);
        this._cachedConfig = this._parseConfig(raw);
        return this._cachedConfig;
    }
    /** Force re-fetch config from chain. */
    async refreshConfig() {
        this._cachedConfig = null;
        return this.getConfig();
    }
    /**
     * Fetch and parse the RoleManager account.
     */
    async getRoles() {
        const raw = await this.program.account.roleManager.fetch(this.roleManagerPda);
        return this._parseRoles(raw);
    }
    /**
     * Get all token holders for this stablecoin.
     *
     * Uses `getProgramAccounts` with filters to find all Token-2022
     * accounts for this mint.
     *
     * @param minBalance - Only return holders with at least this balance
     */
    async getHolders(minBalance) {
        const { AccountLayout } = require("@solana/spl-token");
        // Find all token accounts for this mint
        const accounts = await this.connection.getProgramAccounts(pda_1.TOKEN_2022_PROGRAM_ID, {
            filters: [
                { dataSize: 165 }, // Token account size (base, no extensions)
                {
                    memcmp: {
                        offset: 0, // mint is first field
                        bytes: this.mint.toBase58(),
                    },
                },
            ],
        });
        const holders = [];
        for (const { pubkey, account } of accounts) {
            try {
                // Parse token account data
                // Layout: mint(32) + owner(32) + amount(8) + delegate(36) + state(1) + ...
                const data = account.data;
                const owner = new web3_js_1.PublicKey(data.subarray(32, 64));
                const amount = new anchor_1.BN(data.subarray(64, 72), "le");
                const state = data[108]; // AccountState: 0=uninitialized, 1=initialized, 2=frozen
                if (minBalance && amount.lt(minBalance))
                    continue;
                holders.push({
                    owner,
                    tokenAccount: pubkey,
                    balance: amount,
                    isFrozen: state === 2,
                });
            }
            catch {
                // Skip unparseable accounts
                continue;
            }
        }
        return holders;
    }
    /**
     * Check if this stablecoin is currently paused.
     */
    async isPaused() {
        const config = await this.getConfig();
        return config.isPaused;
    }
    // ================================================================
    // INTERNAL HELPERS
    // ================================================================
    /** Convert SDK RoleType enum to Anchor's on-chain enum format. */
    _toOnChainRoleType(role) {
        switch (role) {
            case types_1.RoleType.Burner:
                return { burner: {} };
            case types_1.RoleType.Pauser:
                return { pauser: {} };
            case types_1.RoleType.Blacklister:
                return { blacklister: {} };
            case types_1.RoleType.Seizer:
                return { seizer: {} };
        }
    }
    /** Parse raw Anchor account data into typed StablecoinConfigAccount. */
    _parseConfig(raw) {
        return {
            name: raw.name,
            symbol: raw.symbol,
            uri: raw.uri,
            decimals: raw.decimals,
            mint: raw.mint,
            enablePermanentDelegate: raw.enablePermanentDelegate,
            enableTransferHook: raw.enableTransferHook,
            defaultAccountFrozen: raw.defaultAccountFrozen,
            isPaused: raw.isPaused,
            totalSupply: raw.totalSupply,
            masterAuthority: raw.masterAuthority,
            pendingMasterAuthority: raw.pendingMasterAuthority ?? null,
            bump: raw.bump,
        };
    }
    /** Parse raw Anchor account data into typed RoleManagerAccount. */
    _parseRoles(raw) {
        return {
            stablecoin: raw.stablecoin,
            minters: raw.minters.map((m) => ({
                address: m.address,
                quota: m.quota,
                minted: m.minted,
                lastResetEpoch: m.lastResetEpoch,
            })),
            burners: raw.burners,
            pausers: raw.pausers,
            blacklisters: raw.blacklisters,
            seizers: raw.seizers,
            bump: raw.bump,
        };
    }
}
exports.SolanaStablecoin = SolanaStablecoin;
//# sourceMappingURL=stablecoin.js.map