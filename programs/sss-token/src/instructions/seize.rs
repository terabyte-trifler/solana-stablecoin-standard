// programs/sss-token/src/instructions/seize.rs
//
// ┌──────────────────────────────────────────────────────────────────┐
// │                      SEIZE — FIXED                               │
// │                                                                  │
// │  THE BUG (0xa261c2c0):                                          │
// │  On SSS-2 mints, the TransferHook extension is active. When     │
// │  Token-2022 processes ANY transfer_checked (including via        │
// │  permanent delegate), it scans for the hook's extra accounts    │
// │  as additional accounts on the CPI instruction. If missing,     │
// │  Token-2022 fails BEFORE invoking the hook — no hook logs.      │
// │                                                                  │
// │  THE FIX:                                                        │
// │  Accept hook accounts via ctx.remaining_accounts and append     │
// │  them to both the instruction's AccountMeta list AND the        │
// │  invoke_signed account_infos. The SDK resolves and passes these.│
// │                                                                  │
// │  For SSS-1 (no hook), remaining_accounts is empty → works fine. │
// └──────────────────────────────────────────────────────────────────┘
//
// REMAINING ACCOUNTS (SSS-2, passed by SDK):
//   [0] ExtraAccountMetaList PDA  — ["extra-account-metas", mint] on hook program
//   [1] sss-transfer-hook program — the hook program itself
//   [2] sss-token program ID      — for blacklist PDA derivation
//   [3] StablecoinConfig PDA      — read by hook for validation
//   [4] Source owner BlacklistEntry PDA  — may not exist (= not blacklisted)
//   [5] Dest owner BlacklistEntry PDA    — may not exist (= not blacklisted)
//
// SEIZE POLICY:
// - Partial seizure: YES (specify exact amount)
// - Source frozen first: NO (not required)
// - Destination: any token account for same mint
// - Non-blacklisted seizure: YES (regulatory orders may precede blacklisting)
// - Requires: both enable_permanent_delegate AND enable_transfer_hook
// - Allowed while paused: YES
// - Does NOT change total_supply (transfer, not burn)
//
// EMITS: TokensSeized

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::TokensSeized;
use crate::state::{RoleManager, StablecoinConfig};

#[derive(Accounts)]
pub struct Seize<'info> {
    /// Must be master_authority or registered seizer.
    pub authority: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        has_one = mint @ SSSError::InvalidMint,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLES_SEED, stablecoin_config.key().as_ref()],
        bump = role_manager.bump,
    )]
    pub role_manager: Account<'info, RoleManager>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The token account to seize FROM.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The treasury/destination token account.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub destination_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: ExtraAccountMetaList PDA for transfer hook resolution.
    /// Passed explicitly so Anchor doesn't filter it out.
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CHECK: The transfer hook program for this mint.
    /// Passed explicitly so Anchor doesn't filter it out.
    pub transfer_hook_program: UncheckedAccount<'info>,

    /// CHECK: sss-token program ID used by hook PDA derivation.
    /// Passed explicitly so Anchor doesn't filter it out.
    pub sss_token_program: UncheckedAccount<'info>,
    
    // Remaining accounts (3 total):
    // [0] StablecoinConfig PDA (duplicate, but needed by hook)
    // [1] Source BlacklistEntry PDA
    // [2] Dest BlacklistEntry PDA
}


pub fn handler<'info>(ctx: Context<'_, '_, '_, 'info, Seize<'info>>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;
    config.require_compliance()?;

    require!(
        config.enable_permanent_delegate,
        SSSError::PermanentDelegateNotEnabled
    );

    require!(amount > 0, SSSError::ZeroAmount);
    require!(
        ctx.accounts.source_token_account.key()
            != ctx.accounts.destination_token_account.key(),
        SSSError::InvalidTokenAccount
    );

    let authority_key = ctx.accounts.authority.key();
    let is_master = authority_key == config.master_authority;
    let is_seizer = ctx.accounts.role_manager.is_seizer(&authority_key);
    require!(is_master || is_seizer, SSSError::UnauthorizedSeizer);

    // ── Build transfer_checked with hook accounts ────────────────

    let mint_key = ctx.accounts.mint.key();
    let signer_seeds = config.as_signer_seeds(&mint_key);
    let signer = &[&signer_seeds[..]];
    let decimals = ctx.accounts.mint.decimals;

    // Build additional accounts for Token-2022's on-chain helper.
    // This helper resolves and appends transfer-hook accounts in the exact
    // order expected by Token-2022 for CPI callers.
    let mut additional_accounts = vec![
        ctx.accounts.extra_account_meta_list.to_account_info(),
        ctx.accounts.transfer_hook_program.to_account_info(),
        ctx.accounts.sss_token_program.to_account_info(),
    ];

    msg!(
        "Adding {} remaining accounts (config + blacklists)",
        ctx.remaining_accounts.len()
    );
    for remaining in ctx.remaining_accounts.iter() {
        additional_accounts.push(remaining.to_account_info());
    }

    msg!(
        "Total additional accounts passed to Token-2022 helper: {}",
        additional_accounts.len()
    );

    spl_token_2022::onchain::invoke_transfer_checked(
        &ctx.accounts.token_program.key(),
        ctx.accounts.source_token_account.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.destination_token_account.to_account_info(),
        ctx.accounts.stablecoin_config.to_account_info(),
        &additional_accounts,
        amount,
        decimals,
        signer,
    )?;

    // ── Emit event ───────────────────────────────────────────────
    let clock = Clock::get()?;
    emit!(TokensSeized {
        config: ctx.accounts.stablecoin_config.key(),
        mint: mint_key,
        from_token_account: ctx.accounts.source_token_account.key(),
        from_owner: ctx.accounts.source_token_account.owner,
        to_token_account: ctx.accounts.destination_token_account.key(),
        amount,
        seized_by: authority_key,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
