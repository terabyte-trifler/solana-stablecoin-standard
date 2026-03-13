// programs/sss-token/src/instructions/update_minter.rs
//
// ALLOWED while paused — admin operations always work.
// Master authority only.
//
// Three sub-operations:
//   add_minter(address, quota) — add new minter with epoch quota
//   remove_minter(address)     — remove existing minter
//   update_minter_quota(address, new_quota) — change quota without resetting minted

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::{MinterAdded, MinterQuotaUpdated, MinterRemoved};
use crate::state::{RoleManager, StablecoinConfig};

#[derive(Accounts)]
pub struct UpdateMinter<'info> {
    /// Must be master_authority.
    pub authority: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
        constraint = stablecoin_config.master_authority == authority.key()
            @ SSSError::UnauthorizedAuthority,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        seeds = [ROLES_SEED, stablecoin_config.key().as_ref()],
        bump = role_manager.bump,
    )]
    pub role_manager: Account<'info, RoleManager>,
}

pub fn handle_add(
    ctx: Context<UpdateMinter>,
    minter: Pubkey,
    quota: u64,
) -> Result<()> {
    ctx.accounts.role_manager.add_minter(minter, quota)?;

    let clock = Clock::get()?;
    emit!(MinterAdded {
        config: ctx.accounts.stablecoin_config.key(),
        minter,
        quota,
        added_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn handle_remove(ctx: Context<UpdateMinter>, minter: Pubkey) -> Result<()> {
    ctx.accounts.role_manager.remove_minter(&minter)?;

    let clock = Clock::get()?;
    emit!(MinterRemoved {
        config: ctx.accounts.stablecoin_config.key(),
        minter,
        removed_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn handle_update_quota(
    ctx: Context<UpdateMinter>,
    minter: Pubkey,
    new_quota: u64,
) -> Result<()> {
    // Get old quota for event
    let old_quota = ctx
        .accounts
        .role_manager
        .minters
        .iter()
        .find(|m| m.address == minter)
        .ok_or(SSSError::RoleNotFound)?
        .quota;

    ctx.accounts
        .role_manager
        .update_minter_quota(&minter, new_quota)?;

    let clock = Clock::get()?;
    emit!(MinterQuotaUpdated {
        config: ctx.accounts.stablecoin_config.key(),
        minter,
        old_quota,
        new_quota,
        updated_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
