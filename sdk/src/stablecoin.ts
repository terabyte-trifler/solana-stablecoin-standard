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

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionSignature,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID as SPL_TOKEN_2022,
} from "@solana/spl-token";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";

import {
  StablecoinCreateOptions,
  StablecoinConfigAccount,
  RoleManagerAccount,
  MintParams,
  BurnParams,
  HolderInfo,
  RoleType,
  MinterEntry,
} from "./types";
import { resolveFeatures, getPresetLabel } from "./presets";
import {
  findStablecoinConfigPda,
  findRoleManagerPda,
  findExtraAccountMetaListPda,
  findAta,
  SSS_TOKEN_PROGRAM_ID,
  SSS_TRANSFER_HOOK_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "./pda";
import { ComplianceModule } from "./compliance";

// Import the generated IDL type from Anchor build
import type { SssToken } from "../idl/sss_token";

// The Anchor program type with proper typing
type SssTokenProgram = Program<SssToken>;

/**
 * The main SDK class for interacting with a Solana Stablecoin Standard instance.
 *
 * Supports both SSS-1 (minimal) and SSS-2 (compliant) stablecoins.
 * SSS-2 features are accessed via the `.compliance` property.
 */
export class SolanaStablecoin {
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

  private _compliance: ComplianceModule | null = null;
  private _cachedConfig: StablecoinConfigAccount | null = null;

  private constructor(
    connection: Connection,
    program: SssTokenProgram,
    configPda: PublicKey,
    mint: PublicKey,
    roleManagerPda: PublicKey,
    isCompliant: boolean,
  ) {
    this.connection = connection;
    this.program = program;
    this.configPda = configPda;
    this.mint = mint;
    this.roleManagerPda = roleManagerPda;

    if (isCompliant) {
      this._compliance = new ComplianceModule(
        connection,
        program,
        configPda,
        mint,
        roleManagerPda,
      );
    }
  }

  // ================================================================
  // COMPLIANCE MODULE (SSS-2)
  // ================================================================

  /**
   * Access SSS-2 compliance features (blacklist, seize, audit).
   * Throws if the stablecoin was created without compliance extensions.
   */
  get compliance(): ComplianceModule {
    if (!this._compliance) {
      throw new Error(
        "Compliance module not available. " +
          "This stablecoin was created without SSS-2 features " +
          "(enablePermanentDelegate + enableTransferHook). " +
          "Use preset: 'SSS_2' when creating to enable compliance.",
      );
    }
    return this._compliance;
  }

  /** Whether this instance has SSS-2 compliance features enabled. */
  get isCompliant(): boolean {
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
  static async create(
    connection: Connection,
    opts: StablecoinCreateOptions,
  ): Promise<SolanaStablecoin> {
    const features = resolveFeatures(opts);
    const decimals = opts.decimals ?? 6;
    const uri = opts.uri ?? "";

    // Generate a fresh keypair for the mint
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;

    // Derive PDAs
    const [configPda] = findStablecoinConfigPda(mint);
    const [roleManagerPda] = findRoleManagerPda(configPda);

    // Build provider and program
    const provider = new AnchorProvider(
      connection,
      new Wallet(opts.authority),
      AnchorProvider.defaultOptions(),
    );
    const program = new Program(
      require("../idl/sss_token.json"),
      provider,
    ) as SssTokenProgram;

    // ── Transaction 1: Initialize ──────────────────────────────
    const initTx = await program.methods
      .initialize(
        opts.name,
        opts.symbol,
        uri,
        decimals,
        features.enablePermanentDelegate,
        features.enableTransferHook,
        features.defaultAccountFrozen,
      )
      .accounts({
        payer: opts.authority.publicKey,
        mint: mint,
        stablecoin_config: configPda,
        role_manager: roleManagerPda,
        token_program: TOKEN_2022_PROGRAM_ID,
        system_program: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([opts.authority, mintKeypair])
      .rpc();

    console.log(`Initialize tx: ${initTx}`);

    // ── Transaction 2: Init hook accounts (SSS-2 only) ─────────
    if (features.enableTransferHook) {
      const [extraMetaListPda] = findExtraAccountMetaListPda(mint);

      const hookTx = await program.methods
        .init_hook_accounts()
        .accounts({
          payer: opts.authority.publicKey,
          stablecoin_config: configPda,
          mint: mint,
          extra_account_meta_list: extraMetaListPda,
          hook_program: SSS_TRANSFER_HOOK_PROGRAM_ID,
          system_program: SystemProgram.programId,
        })
        .signers([opts.authority])
        .rpc();

      console.log(`Init hook accounts tx: ${hookTx}`);
    }

    const isCompliant =
      features.enablePermanentDelegate && features.enableTransferHook;

    return new SolanaStablecoin(
      connection,
      program,
      configPda,
      mint,
      roleManagerPda,
      isCompliant,
    );
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
  static async load(
    connection: Connection,
    configPda: PublicKey,
    wallet?: Keypair,
  ): Promise<SolanaStablecoin> {
    const provider = new AnchorProvider(
      connection,
      wallet ? new Wallet(wallet) : (AnchorProvider.local().wallet as any),
      AnchorProvider.defaultOptions(),
    );
    const program = new Program(
      require("../idl/sss_token.json"),
      provider,
    ) as SssTokenProgram;

    // Fetch config from chain
    const config = await (program.account as any).stablecoin_config.fetch(
      configPda,
    );
    const mint = config.mint as PublicKey;
    const [roleManagerPda] = findRoleManagerPda(configPda);

    const isCompliant =
      (config.enablePermanentDelegate as boolean) &&
      (config.enableTransferHook as boolean);

    return new SolanaStablecoin(
      connection,
      program,
      configPda,
      mint,
      roleManagerPda,
      isCompliant,
    );
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
  async mintTokens(params: MintParams): Promise<TransactionSignature> {
    // Resolve recipient's token account (create ATA if needed)
    const recipientAta = getAssociatedTokenAddressSync(
      this.mint,
      params.recipient,
      true,
      TOKEN_2022_PROGRAM_ID,
    );

    // Check if the ATA exists; if not, prepend create instruction
    const ataInfo = await this.connection.getAccountInfo(recipientAta);

    const builder = this.program.methods
      .mint_tokens(params.amount)
      .accounts({
        authority: params.minter.publicKey,
        stablecoin_config: this.configPda,
        role_manager: this.roleManagerPda,
        mint: this.mint,
        recipient_token_account: recipientAta,
        token_program: TOKEN_2022_PROGRAM_ID,
      })
      .signers([params.minter]);

    if (!ataInfo) {
      // Prepend ATA creation
      builder.preInstructions([
        createAssociatedTokenAccountInstruction(
          params.minter.publicKey, // payer
          recipientAta,
          params.recipient, // owner
          this.mint,
          TOKEN_2022_PROGRAM_ID,
        ),
      ]);
    }

    return builder.rpc();
  }

  /**
   * Burn tokens from the signer's token account.
   *
   * BLOCKED while paused.
   */
  async burn(params: BurnParams): Promise<TransactionSignature> {
    const tokenAccount =
      params.tokenAccount ??
      getAssociatedTokenAddressSync(
        this.mint,
        params.burner.publicKey,
        true,
        TOKEN_2022_PROGRAM_ID,
      );

    return this.program.methods
      .burn_tokens(params.amount)
      .accounts({
        authority: params.burner.publicKey,
        stablecoin_config: this.configPda,
        role_manager: this.roleManagerPda,
        mint: this.mint,
        token_account: tokenAccount,
        token_program: TOKEN_2022_PROGRAM_ID,
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
  async freezeAccount(
    tokenAccount: PublicKey,
    authority: Keypair,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .freeze_account()
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
        mint: this.mint,
        token_account: tokenAccount,
        token_program: TOKEN_2022_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Thaw a frozen token account. Master authority only.
   * ALLOWED while paused.
   */
  async thawAccount(
    tokenAccount: PublicKey,
    authority: Keypair,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .thaw_account()
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
        mint: this.mint,
        token_account: tokenAccount,
        token_program: TOKEN_2022_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Pause all mint/burn operations.
   * Signer must be master authority or registered pauser.
   */
  async pause(authority: Keypair): Promise<TransactionSignature> {
    return this.program.methods
      .pause()
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
        role_manager: this.roleManagerPda,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Unpause operations. Master authority ONLY.
   */
  async unpause(authority: Keypair): Promise<TransactionSignature> {
    return this.program.methods
      .unpause()
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
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
  async addMinter(
    minter: PublicKey,
    quota: BN,
    authority: Keypair,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .add_minter(minter, quota)
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
        role_manager: this.roleManagerPda,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Remove a minter.
   */
  async removeMinter(
    minter: PublicKey,
    authority: Keypair,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .remove_minter(minter)
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
        role_manager: this.roleManagerPda,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Update a minter's per-epoch quota.
   */
  async updateMinterQuota(
    minter: PublicKey,
    newQuota: BN,
    authority: Keypair,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .update_minter_quota(minter, newQuota)
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
        role_manager: this.roleManagerPda,
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
  async grantRole(
    role: RoleType,
    grantee: PublicKey,
    authority: Keypair,
  ): Promise<TransactionSignature> {
    const roleArg = this._toOnChainRoleType(role);
    return this.program.methods
      .grant_role(roleArg, grantee)
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
        role_manager: this.roleManagerPda,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Revoke a role from an address.
   */
  async revokeRole(
    role: RoleType,
    revokee: PublicKey,
    authority: Keypair,
  ): Promise<TransactionSignature> {
    const roleArg = this._toOnChainRoleType(role);
    return this.program.methods
      .revoke_role(roleArg, revokee)
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
        role_manager: this.roleManagerPda,
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
  async transferAuthority(
    newAuthority: PublicKey,
    currentAuthority: Keypair,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .transfer_authority(newAuthority)
      .accounts({
        authority: currentAuthority.publicKey,
        stablecoin_config: this.configPda,
      })
      .signers([currentAuthority])
      .rpc();
  }

  /**
   * Accept a pending authority transfer (step 2).
   * The new authority signs.
   */
  async acceptAuthority(newAuthority: Keypair): Promise<TransactionSignature> {
    return this.program.methods
      .accept_authority()
      .accounts({
        new_authority: newAuthority.publicKey,
        stablecoin_config: this.configPda,
      })
      .signers([newAuthority])
      .rpc();
  }

  /**
   * Cancel a pending authority transfer.
   * Current master authority signs.
   */
  async cancelAuthorityTransfer(
    authority: Keypair,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .cancel_authority_transfer()
      .accounts({
        authority: authority.publicKey,
        stablecoin_config: this.configPda,
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
  async getTotalSupply(): Promise<BN> {
    const config = await this.getConfig();
    return config.totalSupply;
  }

  /**
   * Fetch and parse the StablecoinConfig account.
   * Caches the result; call `refreshConfig()` to force re-fetch.
   */
  async getConfig(): Promise<StablecoinConfigAccount> {
    const raw = await (this.program.account as any).stablecoin_config.fetch(
      this.configPda,
    );
    this._cachedConfig = this._parseConfig(raw);
    return this._cachedConfig;
  }

  /** Force re-fetch config from chain. */
  async refreshConfig(): Promise<StablecoinConfigAccount> {
    this._cachedConfig = null;
    return this.getConfig();
  }

  /**
   * Fetch and parse the RoleManager account.
   */
  async getRoles(): Promise<RoleManagerAccount> {
    const raw = await (this.program.account as any).role_manager.fetch(
      this.roleManagerPda,
    );
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
  async getHolders(minBalance?: BN): Promise<HolderInfo[]> {
    const { AccountLayout } = require("@solana/spl-token");

    // Find all token accounts for this mint
    const accounts = await this.connection.getProgramAccounts(
      TOKEN_2022_PROGRAM_ID,
      {
        filters: [
          { dataSize: 165 }, // Token account size (base, no extensions)
          {
            memcmp: {
              offset: 0, // mint is first field
              bytes: this.mint.toBase58(),
            },
          },
        ],
      },
    );

    const holders: HolderInfo[] = [];
    for (const { pubkey, account } of accounts) {
      try {
        // Parse token account data
        // Layout: mint(32) + owner(32) + amount(8) + delegate(36) + state(1) + ...
        const data = account.data;
        const owner = new PublicKey(data.subarray(32, 64));
        const amount = new BN(data.subarray(64, 72), "le");
        const state = data[108]; // AccountState: 0=uninitialized, 1=initialized, 2=frozen

        if (minBalance && amount.lt(minBalance)) continue;

        holders.push({
          owner,
          tokenAccount: pubkey,
          balance: amount,
          isFrozen: state === 2,
        });
      } catch {
        // Skip unparseable accounts
        continue;
      }
    }

    return holders;
  }

  /**
   * Check if this stablecoin is currently paused.
   */
  async isPaused(): Promise<boolean> {
    const config = await this.getConfig();
    return config.isPaused;
  }

  // ================================================================
  // INTERNAL HELPERS
  // ================================================================

  /** Convert SDK RoleType enum to Anchor's on-chain enum format. */
  private _toOnChainRoleType(role: RoleType): any {
    switch (role) {
      case RoleType.Burner:
        return { burner: {} };
      case RoleType.Pauser:
        return { pauser: {} };
      case RoleType.Blacklister:
        return { blacklister: {} };
      case RoleType.Seizer:
        return { seizer: {} };
    }
  }

  /** Parse raw Anchor account data into typed StablecoinConfigAccount. */
  private _parseConfig(raw: any): StablecoinConfigAccount {
    return {
      name: raw.name as string,
      symbol: raw.symbol as string,
      uri: raw.uri as string,
      decimals: raw.decimals as number,
      mint: raw.mint as PublicKey,
      enablePermanentDelegate: raw.enablePermanentDelegate as boolean,
      enableTransferHook: raw.enableTransferHook as boolean,
      defaultAccountFrozen: raw.defaultAccountFrozen as boolean,
      isPaused: raw.isPaused as boolean,
      totalSupply: raw.totalSupply as BN,
      masterAuthority: raw.masterAuthority as PublicKey,
      pendingMasterAuthority: raw.pendingMasterAuthority ?? null,
      bump: raw.bump as number,
    };
  }

  /** Parse raw Anchor account data into typed RoleManagerAccount. */
  private _parseRoles(raw: any): RoleManagerAccount {
    return {
      stablecoin: raw.stablecoin as PublicKey,
      minters: (raw.minters as any[]).map((m) => ({
        address: m.address as PublicKey,
        quota: m.quota as BN,
        minted: m.minted as BN,
        lastResetEpoch: m.lastResetEpoch as BN,
      })),
      burners: raw.burners as PublicKey[],
      pausers: raw.pausers as PublicKey[],
      blacklisters: raw.blacklisters as PublicKey[],
      seizers: raw.seizers as PublicKey[],
      bump: raw.bump as number,
    };
  }
}
