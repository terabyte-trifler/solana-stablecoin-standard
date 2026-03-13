// programs/sss-token/src/instructions/update_roles.rs
//
// Generic role grant/revoke for simple roles (burner, pauser, blacklister, seizer).
// Minters are handled separately in update_minter.rs because they have quotas.
//
// ALLOWED while paused — admin operations always work.
// Master authority only.
//
// FEATURE GATING:
// - Blacklister role requires enable_transfer_hook (SSS-2)
// - Seizer role requires enable_permanent_delegate (SSS-2)
// - Attempting to grant these roles on SSS-1 fails with ComplianceNotEnabled.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::{RoleGranted, RoleRevoked};
use crate::state::{RoleManager, StablecoinConfig};
use crate::RoleType;

#[derive(Accounts)]
pub struct UpdateRoles<'info> {
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

pub fn handle_grant(
    ctx: Context<UpdateRoles>,
    role: RoleType,
    grantee: Pubkey,
) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;
    let roles = &mut ctx.accounts.role_manager;

    match role {
        RoleType::Burner => {
            roles.add_burner(grantee)?;
        }
        RoleType::Pauser => {
            roles.add_pauser(grantee)?;
        }
        RoleType::Blacklister => {
            // Feature gate: requires SSS-2 (transfer hook enabled)
            require!(config.enable_transfer_hook, SSSError::ComplianceNotEnabled);
            roles.add_blacklister(grantee)?;
        }
        RoleType::Seizer => {
            // Feature gate: requires SSS-2 (permanent delegate enabled)
            require!(
                config.enable_permanent_delegate,
                SSSError::ComplianceNotEnabled
            );
            roles.add_seizer(grantee)?;
        }
    }

    let clock = Clock::get()?;
    emit!(RoleGranted {
        config: ctx.accounts.stablecoin_config.key(),
        role: role.to_string(),
        grantee,
        granted_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn handle_revoke(
    ctx: Context<UpdateRoles>,
    role: RoleType,
    revokee: Pubkey,
) -> Result<()> {
    let roles = &mut ctx.accounts.role_manager;

    match role {
        RoleType::Burner => roles.remove_burner(&revokee)?,
        RoleType::Pauser => roles.remove_pauser(&revokee)?,
        RoleType::Blacklister => roles.remove_blacklister(&revokee)?,
        RoleType::Seizer => roles.remove_seizer(&revokee)?,
    }

    let clock = Clock::get()?;
    emit!(RoleRevoked {
        config: ctx.accounts.stablecoin_config.key(),
        role: role.to_string(),
        revokee,
        revoked_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
