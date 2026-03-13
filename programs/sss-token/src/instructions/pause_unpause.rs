// programs/sss-token/src/instructions/pause_unpause.rs
//
// ┌──────────────────────────────────────────────────────────────────┐
// │                    PAUSE BEHAVIOR MATRIX                         │
// │                                                                  │
// │  Instruction              │ While Paused │ Rationale            │
// │  ─────────────────────────┼──────────────┼────────────────────  │
// │  mint                     │ BLOCKED      │ No new tokens        │
// │  burn                     │ BLOCKED      │ No destruction       │
// │  freeze_account           │ ALLOWED      │ Emergency response   │
// │  thaw_account             │ ALLOWED      │ Fix mistakes         │
// │  add_to_blacklist         │ ALLOWED      │ Compliance continues │
// │  remove_from_blacklist    │ ALLOWED      │ Compliance continues │
// │  seize                    │ ALLOWED      │ Enforcement continues│
// │  pause                    │ N/A (error)  │ Already paused       │
// │  unpause                  │ ALLOWED      │ Resume operations    │
// │  transfer_authority       │ ALLOWED      │ Admin always works   │
// │  accept_authority         │ ALLOWED      │ Admin always works   │
// │  update_minter            │ ALLOWED      │ Admin always works   │
// │  update_roles             │ ALLOWED      │ Admin always works   │
// │                                                                  │
// │  NOTE: Token TRANSFERS between users are NOT affected by pause. │
// │  Transfers go through Token-2022 directly. To halt transfers,   │
// │  freeze individual accounts or use the transfer hook.           │
// └──────────────────────────────────────────────────────────────────┘
//
// PAUSE: signer must be master_authority OR registered pauser
// UNPAUSE: signer must be master_authority ONLY
//   (pausers can stop things but can't restart — safety net if pauser key leaked)

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::{StablecoinPaused, StablecoinUnpaused};
use crate::state::{RoleManager, StablecoinConfig};

// ═══════════════════════════════════════════════════════════════
// PAUSE
// ═══════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct Pause<'info> {
    /// Must be master_authority or registered pauser.
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLES_SEED, stablecoin_config.key().as_ref()],
        bump = role_manager.bump,
    )]
    pub role_manager: Account<'info, RoleManager>,
}

pub fn handle_pause(ctx: Context<Pause>) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;
    let authority_key = ctx.accounts.authority.key();

    // Check authorization
    let is_master = authority_key == config.master_authority;
    let is_pauser = ctx.accounts.role_manager.is_pauser(&authority_key);
    require!(is_master || is_pauser, SSSError::UnauthorizedPauser);

    // Can't pause if already paused
    require!(!config.is_paused, SSSError::AlreadyPaused);

    // Set paused
    let config = &mut ctx.accounts.stablecoin_config;
    config.is_paused = true;

    let clock = Clock::get()?;
    emit!(StablecoinPaused {
        config: ctx.accounts.stablecoin_config.key(),
        paused_by: authority_key,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

// ═══════════════════════════════════════════════════════════════
// UNPAUSE
// ═══════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct Unpause<'info> {
    /// Must be master_authority ONLY. Pausers cannot unpause.
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

pub fn handle_unpause(ctx: Context<Unpause>) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;
    require!(config.is_paused, SSSError::NotPaused);

    let config = &mut ctx.accounts.stablecoin_config;
    config.is_paused = false;

    let clock = Clock::get()?;
    emit!(StablecoinUnpaused {
        config: ctx.accounts.stablecoin_config.key(),
        unpaused_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
