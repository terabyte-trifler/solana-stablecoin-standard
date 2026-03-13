// programs/sss-token/src/instructions/remove_from_blacklist.rs
//
// SSS-2 ONLY. ALLOWED while paused.
//
// VALIDATION:
// ✅ compliance enabled
// ✅ signer is master_authority OR registered blacklister
// ✅ blacklist entry exists (Anchor constraint checks this)
// ✅ entry belongs to this stablecoin config
//
// EMITS: AddressRemovedFromBlacklist
//
// NOTE: Closing the account refunds the rent lamports to the authority.
// The event log in Solana's ledger permanently records that this address
// WAS blacklisted and when it was removed — the on-chain audit trail
// survives account closure.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::AddressRemovedFromBlacklist;
use crate::state::{BlacklistEntry, RoleManager, StablecoinConfig};

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct RemoveFromBlacklist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLES_SEED, stablecoin_config.key().as_ref()],
        bump = role_manager.bump,
    )]
    pub role_manager: Account<'info, RoleManager>,

    /// The BlacklistEntry to close. Anchor's `close` sends rent to authority.
    #[account(
        mut,
        close = authority,
        seeds = [
            BLACKLIST_SEED,
            stablecoin_config.key().as_ref(),
            address.as_ref(),
        ],
        bump = blacklist_entry.bump,
        constraint = blacklist_entry.stablecoin == stablecoin_config.key()
            @ SSSError::InvalidMint,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn handler(ctx: Context<RemoveFromBlacklist>, address: Pubkey) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;
    config.require_compliance()?;

    let authority_key = ctx.accounts.authority.key();
    let is_master = authority_key == config.master_authority;
    let is_blacklister = ctx.accounts.role_manager.is_blacklister(&authority_key);
    require!(is_master || is_blacklister, SSSError::UnauthorizedBlacklister);

    // Account closure handled by Anchor's `close = authority` attribute.
    // The BlacklistEntry PDA is zeroed out and rent returned.

    let clock = Clock::get()?;
    emit!(AddressRemovedFromBlacklist {
        config: ctx.accounts.stablecoin_config.key(),
        address,
        removed_by: authority_key,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
