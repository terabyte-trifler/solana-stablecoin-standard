// programs/sss-token/src/instructions/transfer_authority.rs
//
// TWO-STEP AUTHORITY TRANSFER
//
// Step 1: Current master calls `transfer_authority(new_addr)`
//         → sets pending_master_authority = Some(new_addr)
//
// Step 2: New address calls `accept_authority()`
//         → master_authority = new_addr, pending = None
//
// Cancel: Current master calls `cancel_authority_transfer()`
//         → pending_master_authority = None
//
// ALWAYS allowed while paused — admin operations never stop.
//
// WHY TWO-STEP:
// If you transfer to a wrong address in one step, the stablecoin is
// permanently lost. Two-step ensures the new authority can actually
// sign transactions before the transfer completes.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::{
    AuthorityTransferAccepted, AuthorityTransferCancelled, AuthorityTransferProposed,
};
use crate::state::StablecoinConfig;

// ═══════════════════════════════════════════════════════════════
// PROPOSE (step 1) and CANCEL
// ═══════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    /// Must be current master_authority.
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
        constraint = stablecoin_config.master_authority == authority.key()
            @ SSSError::UnauthorizedAuthority,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,
}

pub fn handle_propose(
    ctx: Context<TransferAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.stablecoin_config;
    config.pending_master_authority = Some(new_authority);

    let clock = Clock::get()?;
    emit!(AuthorityTransferProposed {
        config: ctx.accounts.stablecoin_config.key(),
        current_authority: ctx.accounts.authority.key(),
        proposed_authority: new_authority,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn handle_cancel(ctx: Context<TransferAuthority>) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;
    let cancelled_pending = config
        .pending_master_authority
        .ok_or(SSSError::NoAuthorityTransferPending)?;

    let config = &mut ctx.accounts.stablecoin_config;
    config.pending_master_authority = None;

    let clock = Clock::get()?;
    emit!(AuthorityTransferCancelled {
        config: ctx.accounts.stablecoin_config.key(),
        cancelled_by: ctx.accounts.authority.key(),
        cancelled_pending,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

// ═══════════════════════════════════════════════════════════════
// ACCEPT (step 2) — signed by the PENDING authority
// ═══════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    /// Must be the pending_master_authority.
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,
}

pub fn handle_accept(ctx: Context<AcceptAuthority>) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;
    let pending = config
        .pending_master_authority
        .ok_or(SSSError::NoAuthorityTransferPending)?;

    // Verify the signer IS the pending authority
    require!(
        ctx.accounts.new_authority.key() == pending,
        SSSError::UnauthorizedPendingAuthority
    );

    let previous = config.master_authority;

    let config = &mut ctx.accounts.stablecoin_config;
    config.master_authority = pending;
    config.pending_master_authority = None;

    let clock = Clock::get()?;
    emit!(AuthorityTransferAccepted {
        config: ctx.accounts.stablecoin_config.key(),
        previous_authority: previous,
        new_authority: pending,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
