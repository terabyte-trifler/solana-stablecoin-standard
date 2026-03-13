// programs/sss-token/src/instructions/seize.rs
//
// ┌──────────────────────────────────────────────────────────────────┐
// │                      SEIZE POLICY                                │
// │                                                                  │
// │  Q: Can seizure be partial?                                      │
// │  A: YES. The `amount` parameter specifies exactly how much to   │
// │     seize. Seize 0 is rejected. Seize > balance will fail at    │
// │     the Token-2022 level.                                        │
// │                                                                  │
// │  Q: Must the source account be frozen first?                     │
// │  A: NO. Operationally, you'll usually freeze → blacklist →      │
// │     seize, but the instruction doesn't enforce this ordering.   │
// │     Reason: court orders may require immediate seizure before   │
// │     any freeze.                                                  │
// │                                                                  │
// │  Q: Who selects the destination (treasury)?                      │
// │  A: The seizer passes it as an account parameter. It must be    │
// │     a token account for the same mint. There's no pre-approved  │
// │     treasury list — the seizer decides. In production, the      │
// │     seizer keys are tightly controlled (multisig), so this is   │
// │     acceptable.                                                  │
// │                                                                  │
// │  Q: Can a seizer seize from any account, even non-blacklisted?  │
// │  A: YES. Regulatory orders may require asset recovery before    │
// │     the address is formally blacklisted. The blacklist and      │
// │     seizure are independent compliance tools.                   │
// │                                                                  │
// │  Q: What permissions are required?                               │
// │  A: enable_permanent_delegate AND enable_transfer_hook must     │
// │     both be true (full compliance mode), AND the signer must   │
// │     be master_authority or a registered seizer.                 │
// └──────────────────────────────────────────────────────────────────┘
//
// HOW IT WORKS:
// The PermanentDelegate extension gives the config PDA the ability to
// call `transfer_checked` on ANY token account of this mint, regardless
// of who owns that account. The config PDA signs the CPI as if it were
// the account owner.
//
// ALLOWED while paused — enforcement never stops.
//
// VALIDATION:
// ✅ compliance enabled (is_compliant: both extensions active)
// ✅ signer is master_authority OR registered seizer
// ✅ amount > 0
// ✅ source token account uses same mint
// ✅ destination token account uses same mint
// ✅ source != destination
//
// EMITS: TokensSeized
//
// NOTE: Seize does NOT affect total_supply — it's a transfer, not a burn.

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

    /// The token account to seize FROM. Can be any account for this mint.
    /// The permanent delegate (config PDA) overrides ownership.
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
}

pub fn handler(ctx: Context<Seize>, amount: u64) -> Result<()> {
    // ── Feature gate ─────────────────────────────────────────────
    let config = &ctx.accounts.stablecoin_config;
    config.require_compliance()?;

    // Also explicitly check permanent delegate since seize depends on it
    require!(
        config.enable_permanent_delegate,
        SSSError::PermanentDelegateNotEnabled
    );

    // ── Validate ─────────────────────────────────────────────────
    require!(amount > 0, SSSError::ZeroAmount);
    require!(
        ctx.accounts.source_token_account.key()
            != ctx.accounts.destination_token_account.key(),
        SSSError::InvalidTokenAccount
    );

    // ── Authorization ────────────────────────────────────────────
    let authority_key = ctx.accounts.authority.key();
    let is_master = authority_key == config.master_authority;
    let is_seizer = ctx.accounts.role_manager.is_seizer(&authority_key);
    require!(is_master || is_seizer, SSSError::UnauthorizedSeizer);

    // ── Execute transfer via permanent delegate ──────────────────
    // The config PDA IS the permanent delegate (set during initialize).
    // It can transfer from any token account of this mint.
    //
    // We use `transfer_checked` which requires the decimal count.
    // The permanent delegate signs as the "owner" of the source account.

    let mint_key = ctx.accounts.mint.key();
    let signer_seeds = config.as_signer_seeds(&mint_key);
    let signer = &[&signer_seeds[..]];

    let decimals = ctx.accounts.mint.decimals;

    // Build the transfer_checked CPI manually because anchor-spl's
    // transfer_checked expects the real owner to sign, but with
    // permanent delegate the delegate signs instead.
    let ix = spl_token_2022::instruction::transfer_checked(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.source_token_account.key(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.destination_token_account.key(),
        &ctx.accounts.stablecoin_config.key(), // delegate as authority
        &[],
        amount,
        decimals,
    )?;

    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.source_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.destination_token_account.to_account_info(),
            ctx.accounts.stablecoin_config.to_account_info(),
        ],
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
