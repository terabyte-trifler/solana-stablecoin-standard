// programs/sss-token/src/instructions/add_to_blacklist.rs
//
// SSS-2 ONLY. ALLOWED while paused (compliance operations never stop).
//
// VALIDATION CHECKLIST:
// ✅ compliance enabled (enable_transfer_hook == true)
// ✅ signer is master_authority OR registered blacklister
// ✅ address not already blacklisted (PDA doesn't exist yet — Anchor init handles this)
// ✅ reason is 1–100 bytes, non-empty
//
// WHAT GETS BLACKLISTED:
// WALLET OWNER addresses, not token accounts.
// The transfer hook resolves token account → owner → blacklist PDA.
//
// EMITS: AddressBlacklisted

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SSSError;
use crate::events::AddressBlacklisted;
use crate::state::{BlacklistEntry, RoleManager, StablecoinConfig};

#[derive(Accounts)]
#[instruction(address: Pubkey, reason: String)]
pub struct AddToBlacklist<'info> {
    /// Must be master_authority or registered blacklister.
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

    /// The BlacklistEntry PDA to create.
    /// Seeds: ["blacklist", stablecoin_config, target_wallet_address]
    /// If this account already exists, Anchor's `init` will fail
    /// with "already in use" — that's our "already blacklisted" check.
    #[account(
        init,
        payer = authority,
        space = BLACKLIST_ENTRY_SIZE,
        seeds = [
            BLACKLIST_SEED,
            stablecoin_config.key().as_ref(),
            address.as_ref(),
        ],
        bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AddToBlacklist>,
    address: Pubkey,
    reason: String,
) -> Result<()> {
    let config = &ctx.accounts.stablecoin_config;

    // ── Feature gate ─────────────────────────────────────────────
    config.require_compliance()?;

    // ── Authorization ────────────────────────────────────────────
    let authority_key = ctx.accounts.authority.key();
    let is_master = authority_key == config.master_authority;
    let is_blacklister = ctx.accounts.role_manager.is_blacklister(&authority_key);
    require!(is_master || is_blacklister, SSSError::UnauthorizedBlacklister);

    // ── Validate reason ──────────────────────────────────────────
    BlacklistEntry::validate_reason(&reason)?;

    // ── Populate the blacklist entry ─────────────────────────────
    let clock = Clock::get()?;
    let entry = &mut ctx.accounts.blacklist_entry;
    entry.stablecoin = ctx.accounts.stablecoin_config.key();
    entry.address = address;
    entry.reason = reason.clone();
    entry.blacklisted_at = clock.unix_timestamp;
    entry.blacklisted_by = authority_key;
    entry.bump = ctx.bumps.blacklist_entry;

    // ── Emit event ───────────────────────────────────────────────
    emit!(AddressBlacklisted {
        config: ctx.accounts.stablecoin_config.key(),
        address,
        reason,
        blacklisted_by: authority_key,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
