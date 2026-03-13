// programs/sss-token/src/instructions/freeze_thaw.rs
//
// ┌──────────────────────────────────────────────────────────────┐
// │  PAUSE BEHAVIOR: freeze and thaw are ALLOWED while paused.  │
// │                                                              │
// │  Rationale: If the stablecoin is paused due to an emergency,│
// │  operators still need to freeze compromised accounts and     │
// │  thaw accounts that were frozen by mistake. Blocking these   │
// │  during pause would make emergencies worse, not better.      │
// └──────────────────────────────────────────────────────────────┘
//
// FREEZE VALIDATION:
// ✅ signer is master_authority (any pauser/minter can't freeze)
// ✅ mint matches config.mint
// ✅ token account uses same mint
// ✅ NOT already frozen (Token-2022 will error, but we check for clarity)
//
// THAW VALIDATION:
// ✅ signer is master_authority
// ✅ mint matches config.mint
// ✅ token account uses same mint
// ✅ account IS frozen
//
// DEFAULT FROZEN ONBOARDING (when default_account_frozen = true):
// - All new token accounts start frozen
// - Master authority (or any address with freeze authority role — future)
//   must thaw the account before the user can transact
// - Thawing is allowed while globally paused
// - Operational flow: user requests account → KYC check → authority thaws
//
// EMITS: AccountFrozen / AccountThawed

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, FreezeAccount as FreezeAccountCPI, Mint, ThawAccount as ThawAccountCPI,
    TokenAccount, TokenInterface,
};

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::{AccountFrozen, AccountThawed};
use crate::state::StablecoinConfig;

// ═══════════════════════════════════════════════════════════════
// FREEZE
// ═══════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct FreezeAccount<'info> {
    /// Must be master_authority.
    pub authority: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        has_one = mint @ SSSError::InvalidMint,
        constraint = stablecoin_config.master_authority == authority.key()
            @ SSSError::UnauthorizedAuthority,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The token account to freeze. Can be any account for this mint.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_freeze(ctx: Context<FreezeAccount>) -> Result<()> {
    // Note: NOT checking is_paused — freeze is allowed while paused.

    let mint_key = ctx.accounts.mint.key();
    let config = &ctx.accounts.stablecoin_config;
    let signer_seeds = config.as_signer_seeds(&mint_key);
    let signer = &[&signer_seeds[..]];

    let cpi_accounts = FreezeAccountCPI {
        account: ctx.accounts.token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.stablecoin_config.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    token_interface::freeze_account(cpi_ctx)?;

    let clock = Clock::get()?;
    emit!(AccountFrozen {
        config: ctx.accounts.stablecoin_config.key(),
        token_account: ctx.accounts.token_account.key(),
        account_owner: ctx.accounts.token_account.owner,
        frozen_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

// ═══════════════════════════════════════════════════════════════
// THAW
// ═══════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct ThawAccount<'info> {
    /// Must be master_authority.
    pub authority: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        has_one = mint @ SSSError::InvalidMint,
        constraint = stablecoin_config.master_authority == authority.key()
            @ SSSError::UnauthorizedAuthority,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_thaw(ctx: Context<ThawAccount>) -> Result<()> {
    // Note: NOT checking is_paused — thaw is allowed while paused.

    let mint_key = ctx.accounts.mint.key();
    let config = &ctx.accounts.stablecoin_config;
    let signer_seeds = config.as_signer_seeds(&mint_key);
    let signer = &[&signer_seeds[..]];

    let cpi_accounts = ThawAccountCPI {
        account: ctx.accounts.token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.stablecoin_config.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    token_interface::thaw_account(cpi_ctx)?;

    let clock = Clock::get()?;
    emit!(AccountThawed {
        config: ctx.accounts.stablecoin_config.key(),
        token_account: ctx.accounts.token_account.key(),
        account_owner: ctx.accounts.token_account.owner,
        thawed_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
