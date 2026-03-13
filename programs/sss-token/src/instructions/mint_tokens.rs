// programs/sss-token/src/instructions/mint_tokens.rs
//
// VALIDATION CHECKLIST:
// ✅ amount > 0
// ✅ stablecoin not paused
// ✅ signer is master_authority OR registered minter
// ✅ mint matches config.mint
// ✅ recipient token account uses same mint
// ✅ minter quota not exceeded (with lazy epoch reset)
// ✅ total_supply update does not overflow
//
// EMITS: TokensMinted

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::TokensMinted;
use crate::state::{RoleManager, StablecoinConfig};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    /// The operator signing this mint. Must be master_authority or a
    /// registered minter in the RoleManager.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The stablecoin configuration. Checked for pause state and mint match.
    /// Mutable because we update total_supply.
    #[account(
        mut,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin_config.bump,
        has_one = mint @ SSSError::InvalidMint,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    /// Role manager — checked for minter authorization.
    /// Mutable because we update the minter's quota tracking.
    #[account(
        mut,
        seeds = [ROLES_SEED, stablecoin_config.key().as_ref()],
        bump = role_manager.bump,
        constraint = role_manager.stablecoin == stablecoin_config.key() @ SSSError::InvalidMint,
    )]
    pub role_manager: Account<'info, RoleManager>,

    /// The Token-2022 mint. Config PDA is the mint authority.
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// Recipient's token account. Must be the same mint.
    /// Does NOT need to be an ATA — any token account for this mint works.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    // ── Validate ─────────────────────────────────────────────────

    require!(amount > 0, SSSError::ZeroAmount);

    let config = &ctx.accounts.stablecoin_config;
    config.require_not_paused()?;

    // ── Authorization ────────────────────────────────────────────
    // Master authority can always mint. Otherwise check minter role.

    let authority_key = ctx.accounts.authority.key();
    let is_master = authority_key == config.master_authority;

    if !is_master {
        // Must be a registered minter — find and update quota
        let roles = &mut ctx.accounts.role_manager;
        let minter_entry = roles
            .find_minter_mut(&authority_key)
            .ok_or(SSSError::UnauthorizedMinter)?;

        let clock = Clock::get()?;
        minter_entry.check_and_update_quota(amount, clock.epoch)?;
    }

    // ── Execute mint CPI ─────────────────────────────────────────
    // The config PDA signs as mint authority.

    let mint_key = ctx.accounts.mint.key();
    let config = &ctx.accounts.stablecoin_config;
    let signer_seeds = config.as_signer_seeds(&mint_key);
    let signer = &[&signer_seeds[..]];

    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.stablecoin_config.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    token_interface::mint_to(cpi_ctx, amount)?;

    // ── Update total supply ──────────────────────────────────────

    let config = &mut ctx.accounts.stablecoin_config;
    config.total_supply = config
        .total_supply
        .checked_add(amount)
        .ok_or(SSSError::MathOverflow)?;

    // ── Emit event ───────────────────────────────────────────────

    let clock = Clock::get()?;
    emit!(TokensMinted {
        config: ctx.accounts.stablecoin_config.key(),
        mint: mint_key,
        recipient: ctx.accounts.recipient_token_account.key(),
        amount,
        minter: authority_key,
        new_total_supply: config.total_supply,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
