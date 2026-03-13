// programs/sss-token/src/instructions/burn_tokens.rs
//
// VALIDATION CHECKLIST:
// ✅ amount > 0
// ✅ stablecoin not paused
// ✅ signer is master_authority OR registered burner
// ✅ mint matches config.mint
// ✅ token account owned by signer and uses same mint
// ✅ sufficient balance
// ✅ total_supply decrement does not underflow
//
// EMITS: TokensBurned

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Burn, Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::TokensBurned;
use crate::state::{RoleManager, StablecoinConfig};

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    /// The operator signing this burn. Must be master_authority or burner.
    /// Also must be the owner of the token account being burned from.
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
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

    /// Token account to burn from. Must be owned by the signer.
    #[account(
        mut,
        token::mint = mint,
        token::authority = authority,
        token::token_program = token_program,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SSSError::ZeroAmount);

    let config = &ctx.accounts.stablecoin_config;
    config.require_not_paused()?;

    // ── Authorization ────────────────────────────────────────────
    let authority_key = ctx.accounts.authority.key();
    let is_master = authority_key == config.master_authority;
    let is_burner = ctx.accounts.role_manager.is_burner(&authority_key);

    require!(is_master || is_burner, SSSError::UnauthorizedBurner);

    // ── Check balance ────────────────────────────────────────────
    require!(
        ctx.accounts.token_account.amount >= amount,
        SSSError::InsufficientBalance
    );

    // ── Execute burn CPI ─────────────────────────────────────────
    // The signer (authority) is the token account owner, so they sign directly.
    // No PDA signing needed — the human owns the token account.
    let cpi_accounts = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.token_account.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token_interface::burn(cpi_ctx, amount)?;

    // ── Update total supply ──────────────────────────────────────
    // Capture values before mutable borrow to avoid borrow checker issues

    let config_key = ctx.accounts.stablecoin_config.key();
    let mint_key = ctx.accounts.mint.key();
    let new_total_supply = {
        let config = &mut ctx.accounts.stablecoin_config;
        config.total_supply = config
            .total_supply
            .checked_sub(amount)
            .ok_or(SSSError::MathOverflow)?;
        config.total_supply
    };

    let clock = Clock::get()?;
    emit!(TokensBurned {
        config: config_key,
        mint: mint_key,
        amount,
        burner: authority_key,
        new_total_supply,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
