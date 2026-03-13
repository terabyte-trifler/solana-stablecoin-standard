// programs/sss-token/src/instructions/initialize.rs
//
// ┌──────────────────────────────────────────────────────────────────┐
// │                    INITIALIZE INSTRUCTION                        │
// │                                                                  │
// │  Creates everything needed for a new stablecoin instance:       │
// │                                                                  │
// │  1. Token-2022 Mint with preset-based extensions                │
// │  2. StablecoinConfig PDA (program state)                        │
// │  3. RoleManager PDA (RBAC)                                      │
// │                                                                  │
// │  AUTHORITY MODEL:                                                │
// │  ┌─────────────────────────────────────────────────────────┐    │
// │  │  mint_authority   = StablecoinConfig PDA (program-owned)│    │
// │  │  freeze_authority = StablecoinConfig PDA (program-owned)│    │
// │  │  permanent_delegate = StablecoinConfig PDA (SSS-2 only) │    │
// │  │  transfer_hook_authority = StablecoinConfig PDA          │    │
// │  │  metadata update authority = StablecoinConfig PDA        │    │
// │  │                                                         │    │
// │  │  master_authority = human/multisig signer               │    │
// │  │    → authorizes operations by signing transactions      │    │
// │  │    → NEVER directly owns token authorities              │    │
// │  │    → governs the stablecoin THROUGH the program         │    │
// │  └─────────────────────────────────────────────────────────┘    │
// │                                                                  │
// │  EXTENSION INIT ORDER (Token-2022 requirement):                 │
// │  Extensions MUST be initialized BEFORE InitializeMint2.         │
// │  The mint account space must include room for all extensions.   │
// │                                                                  │
// │  Order:                                                          │
// │  1. CreateAccount (allocate space for mint + all extensions)    │
// │  2. InitializePermanentDelegate (SSS-2)                        │
// │  3. InitializeTransferHook (SSS-2)                             │
// │  4. InitializeDefaultAccountState (if enabled)                  │
// │  5. InitializeMetadataPointer                                   │
// │  6. InitializeMint2 (sets mint/freeze authority)               │
// │  7. InitializeTokenMetadata (name, symbol, uri)                │
// │                                                                  │
// │  EXTRA ACCOUNT META LIST (SSS-2):                               │
// │  When transfer_hook is enabled, the ExtraAccountMetaList must   │
// │  be initialized AFTER the mint exists but BEFORE any transfers. │
// │  We do this in a separate instruction (init_hook_accounts)      │
// │  called right after initialize, because the transfer hook is    │
// │  a separate program and needs its own PDA derivation.           │
// └──────────────────────────────────────────────────────────────────┘

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::StablecoinInitialized;
use crate::state::{RoleManager, StablecoinConfig};

/// Accounts required for the `initialize` instruction.
///
/// The payer creates and funds three accounts:
/// 1. The Token-2022 Mint (variable size based on extensions)
/// 2. StablecoinConfig PDA
/// 3. RoleManager PDA
#[derive(Accounts)]
#[instruction(
    name: String,
    symbol: String,
    uri: String,
    decimals: u8,
    enable_permanent_delegate: bool,
    enable_transfer_hook: bool,
    default_account_frozen: bool,
)]
pub struct Initialize<'info> {
    // ── Signers ──────────────────────────────────────────────────

    /// The wallet paying for account creation rent.
    /// Also becomes the initial master_authority.
    #[account(mut)]
    pub payer: Signer<'info>,

    // ── Mint (created in this instruction) ───────────────────────

    /// The Token-2022 mint account. Must be a fresh keypair.
    /// We do NOT use Anchor's `init` here because we need manual
    /// control over extension initialization order.
    /// CHECK: We create and initialize this account manually via CPI.
    #[account(mut)]
    pub mint: Signer<'info>,

    // ── Program PDAs (created by Anchor) ─────────────────────────

    /// StablecoinConfig PDA — seeds: ["stablecoin", mint]
    /// Anchor's `init` handles creation + space + rent.
    #[account(
        init,
        payer = payer,
        space = STABLECOIN_CONFIG_SIZE,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    /// RoleManager PDA — seeds: ["roles", stablecoin_config]
    #[account(
        init,
        payer = payer,
        space = ROLE_MANAGER_SIZE,
        seeds = [ROLES_SEED, stablecoin_config.key().as_ref()],
        bump,
    )]
    pub role_manager: Account<'info, RoleManager>,

    // ── Programs ─────────────────────────────────────────────────

    /// Token-2022 program (NOT legacy SPL Token).
    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,

    /// Rent sysvar — needed for mint account creation.
    pub rent: Sysvar<'info, Rent>,
}

/// Handler for the `initialize` instruction.
///
/// # Validation Rules
/// - name: 1–32 bytes, non-empty
/// - symbol: 1–10 bytes, non-empty
/// - uri: 0–200 bytes (can be empty)
/// - decimals: 0–9
/// - payer becomes master_authority
/// - mint must be a fresh account (no data)
pub fn handler(
    ctx: Context<Initialize>,
    name: String,
    symbol: String,
    uri: String,
    decimals: u8,
    enable_permanent_delegate: bool,
    enable_transfer_hook: bool,
    default_account_frozen: bool,
) -> Result<()> {
    // ── Step 0: Validate inputs ──────────────────────────────────

    StablecoinConfig::validate_string_lengths(&name, &symbol, &uri)?;

    require!(decimals <= 9, SSSError::InvalidDecimals);

    // ── Step 1: Calculate mint account size ──────────────────────
    // Token-2022 mints have variable size depending on extensions.
    // We use the spl_token_2022 function to compute the exact space.

    let mut extension_types = vec![
        // All presets get metadata
        spl_token_2022::extension::ExtensionType::MetadataPointer,
    ];

    if enable_permanent_delegate {
        extension_types.push(spl_token_2022::extension::ExtensionType::PermanentDelegate);
    }
    if enable_transfer_hook {
        extension_types.push(spl_token_2022::extension::ExtensionType::TransferHook);
    }
    if default_account_frozen {
        extension_types.push(spl_token_2022::extension::ExtensionType::DefaultAccountState);
    }

    // Calculate space for mint + all extensions
    let mint_space =
        spl_token_2022::extension::ExtensionType::try_calculate_account_len::<
            spl_token_2022::state::Mint,
        >(&extension_types)
        .map_err(|_| SSSError::MathOverflow)?;

    // Add space for token metadata (variable-length: name + symbol + uri)
    // TokenMetadata uses TLV encoding: 4 (type) + 4 (length) + data
    let metadata_space = spl_token_metadata_interface::state::TokenMetadata {
        name: name.clone(),
        symbol: symbol.clone(),
        uri: uri.clone(),
        ..Default::default()
    };
    let total_mint_space =
        mint_space + spl_type_length_value::variable_len_pack::VariableLenPack::get_packed_len(
            &metadata_space,
        ).map_err(|_| SSSError::MathOverflow)?;

    let rent = &ctx.accounts.rent;
    let mint_rent = rent.minimum_balance(total_mint_space);

    let mint_key = ctx.accounts.mint.key();
    let config_key = ctx.accounts.stablecoin_config.key();

    // ── Step 2: Create the mint account ──────────────────────────
    // We allocate space owned by the Token-2022 program.

    invoke_signed(
        &system_instruction::create_account(
            &ctx.accounts.payer.key(),
            &mint_key,
            mint_rent,
            total_mint_space as u64,
            &ctx.accounts.token_program.key(),
        ),
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[], // mint is a Signer, no PDA seeds needed
    )?;

    // ── Step 3: Initialize extensions BEFORE InitializeMint2 ─────
    // TOKEN-2022 RULE: All extensions must be initialized before the
    // mint itself. Violating this order causes irrecoverable failure.

    let token_program_id = ctx.accounts.token_program.key();

    // 3a. PermanentDelegate (SSS-2)
    // The config PDA is the permanent delegate — it can transfer/burn
    // from ANY token account of this mint.
    if enable_permanent_delegate {
        let ix = spl_token_2022::instruction::initialize_permanent_delegate(
            &token_program_id,
            &mint_key,
            &config_key, // delegate = our config PDA
        )?;
        invoke_signed(
            &ix,
            &[
                ctx.accounts.mint.to_account_info(),
            ],
            &[],
        )?;
    }

    // 3b. TransferHook (SSS-2)
    // Points to the sss-transfer-hook program for blacklist enforcement.
    // The hook authority is set to the config PDA so we can update it.
    if enable_transfer_hook {
        let hook_program_id = crate::constants::TRANSFER_HOOK_PROGRAM_ID;
        let ix = spl_token_2022::instruction::initialize_transfer_hook(
            &token_program_id,
            &mint_key,
            Some(config_key), // authority = config PDA
            Some(hook_program_id),
        )?;
        invoke_signed(
            &ix,
            &[
                ctx.accounts.mint.to_account_info(),
            ],
            &[],
        )?;
    }

    // 3c. DefaultAccountState (optional)
    // When enabled, all new token accounts start frozen.
    // Users must be explicitly thawed before they can transact.
    if default_account_frozen {
        let ix =
            spl_token_2022::extension::default_account_state::instruction::initialize_default_account_state(
                &token_program_id,
                &mint_key,
                &spl_token_2022::state::AccountState::Frozen,
            )?;
        invoke_signed(
            &ix,
            &[
                ctx.accounts.mint.to_account_info(),
            ],
            &[],
        )?;
    }

    // 3d. MetadataPointer
    // Points metadata to the mint itself (on-chain metadata stored in mint account).
    let ix = spl_token_2022::extension::metadata_pointer::instruction::initialize(
        &token_program_id,
        &mint_key,
        Some(config_key), // authority
        Some(mint_key),   // metadata address = the mint itself
    )?;
    invoke_signed(
        &ix,
        &[ctx.accounts.mint.to_account_info()],
        &[],
    )?;

    // ── Step 4: InitializeMint2 ──────────────────────────────────
    // Sets mint authority and freeze authority to the config PDA.
    // InitializeMint2 is the newer version that doesn't need rent sysvar.
    let ix = spl_token_2022::instruction::initialize_mint2(
        &token_program_id,
        &mint_key,
        &config_key, // mint authority = config PDA
        Some(&config_key), // freeze authority = config PDA
        decimals,
    )?;
    invoke_signed(
        &ix,
        &[ctx.accounts.mint.to_account_info()],
        &[],
    )?;

    // ── Step 5: Initialize Token Metadata ────────────────────────
    // Write name/symbol/uri into the mint's metadata extension.
    // The config PDA signs as the metadata update authority.

    let config_bump = ctx.bumps.stablecoin_config;
    let signer_seeds: &[&[u8]] = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[config_bump],
    ];

    let ix = spl_token_metadata_interface::instruction::initialize(
        &token_program_id,
        &mint_key,       // metadata account = the mint
        &config_key,     // update authority
        &mint_key,       // mint
        &config_key,     // mint authority (signs)
        name.clone(),
        symbol.clone(),
        uri.clone(),
    );
    invoke_signed(
        &ix,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.stablecoin_config.to_account_info(),
        ],
        &[signer_seeds],
    )?;

    // ── Step 6: Populate StablecoinConfig ────────────────────────

    let config = &mut ctx.accounts.stablecoin_config;
    config.name = name.clone();
    config.symbol = symbol.clone();
    config.uri = uri.clone();
    config.decimals = decimals;
    config.mint = mint_key;
    config.enable_permanent_delegate = enable_permanent_delegate;
    config.enable_transfer_hook = enable_transfer_hook;
    config.default_account_frozen = default_account_frozen;
    config.is_paused = false;
    config.total_supply = 0;
    config.master_authority = ctx.accounts.payer.key();
    config.pending_master_authority = None;
    config.bump = config_bump;

    // ── Step 7: Populate RoleManager ─────────────────────────────

    let roles = &mut ctx.accounts.role_manager;
    roles.stablecoin = config_key;
    roles.minters = Vec::new();
    roles.burners = Vec::new();
    roles.pausers = Vec::new();
    roles.blacklisters = Vec::new();
    roles.seizers = Vec::new();
    roles.bump = ctx.bumps.role_manager;

    // ── Step 8: Emit event ───────────────────────────────────────

    let clock = Clock::get()?;
    let preset = if enable_permanent_delegate && enable_transfer_hook {
        "SSS-2".to_string()
    } else if !enable_permanent_delegate && !enable_transfer_hook {
        "SSS-1".to_string()
    } else {
        "custom".to_string()
    };

    emit!(StablecoinInitialized {
        config: config_key,
        mint: mint_key,
        name,
        symbol,
        decimals,
        preset,
        authority: ctx.accounts.payer.key(),
        permanent_delegate: enable_permanent_delegate,
        transfer_hook: enable_transfer_hook,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
