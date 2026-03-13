// programs/sss-token/src/lib.rs
//
// Solana Stablecoin Standard (SSS) — Main Program
//
// ┌──────────────────────────────────────────────────────────────────┐
// │  EVENT-TO-INSTRUCTION MAPPING                                    │
// │                                                                  │
// │  initialize              → StablecoinInitialized                │
// │  mint_tokens             → TokensMinted                         │
// │  burn_tokens             → TokensBurned                         │
// │  freeze_account          → AccountFrozen                        │
// │  thaw_account            → AccountThawed                        │
// │  pause                   → StablecoinPaused                     │
// │  unpause                 → StablecoinUnpaused                   │
// │  add_minter              → MinterAdded                          │
// │  remove_minter           → MinterRemoved                        │
// │  update_minter_quota     → MinterQuotaUpdated                   │
// │  grant_role              → RoleGranted                          │
// │  revoke_role             → RoleRevoked                          │
// │  transfer_authority      → AuthorityTransferProposed            │
// │  accept_authority        → AuthorityTransferAccepted            │
// │  cancel_authority_transfer → AuthorityTransferCancelled         │
// │  add_to_blacklist        → AddressBlacklisted                   │
// │  remove_from_blacklist   → AddressRemovedFromBlacklist          │
// │  seize                   → TokensSeized                         │
// └──────────────────────────────────────────────────────────────────┘

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use errors::*;
pub use state::*;

declare_id!("sW63DevsGFLUj9hsGutuqazT6zGJr7vvWG4FusG6tTk");

#[program]
pub mod sss_token {
    use super::*;

    pub fn initialize(
        ctx: Context<instructions::Initialize>,
        name: String,
        symbol: String,
        uri: String,
        decimals: u8,
        enable_permanent_delegate: bool,
        enable_transfer_hook: bool,
        default_account_frozen: bool,
    ) -> Result<()> {
        instructions::initialize::handler(
            ctx, name, symbol, uri, decimals,
            enable_permanent_delegate, enable_transfer_hook,
            default_account_frozen,
        )
    }

    /// Initialize the transfer hook's ExtraAccountMetaList for SSS-2 mints.
    /// Must be called after `initialize` and before any token transfers.
    pub fn init_hook_accounts(ctx: Context<instructions::InitHookAccounts>) -> Result<()> {
        instructions::init_hook_accounts::handler(ctx)
    }

    pub fn mint_tokens(ctx: Context<instructions::MintTokens>, amount: u64) -> Result<()> {
        instructions::mint_tokens::handler(ctx, amount)
    }

    pub fn burn_tokens(ctx: Context<instructions::BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn_tokens::handler(ctx, amount)
    }

    pub fn freeze_account(ctx: Context<instructions::FreezeAccount>) -> Result<()> {
        instructions::freeze_thaw::handle_freeze(ctx)
    }

    pub fn thaw_account(ctx: Context<instructions::ThawAccount>) -> Result<()> {
        instructions::freeze_thaw::handle_thaw(ctx)
    }

    pub fn pause(ctx: Context<instructions::Pause>) -> Result<()> {
        instructions::pause_unpause::handle_pause(ctx)
    }

    pub fn unpause(ctx: Context<instructions::Unpause>) -> Result<()> {
        instructions::pause_unpause::handle_unpause(ctx)
    }

    pub fn add_minter(
        ctx: Context<instructions::UpdateMinter>,
        minter: Pubkey,
        quota: u64,
    ) -> Result<()> {
        instructions::update_minter::handle_add(ctx, minter, quota)
    }

    pub fn remove_minter(
        ctx: Context<instructions::UpdateMinter>,
        minter: Pubkey,
    ) -> Result<()> {
        instructions::update_minter::handle_remove(ctx, minter)
    }

    pub fn update_minter_quota(
        ctx: Context<instructions::UpdateMinter>,
        minter: Pubkey,
        new_quota: u64,
    ) -> Result<()> {
        instructions::update_minter::handle_update_quota(ctx, minter, new_quota)
    }

    pub fn grant_role(
        ctx: Context<instructions::UpdateRoles>,
        role: RoleType,
        grantee: Pubkey,
    ) -> Result<()> {
        instructions::update_roles::handle_grant(ctx, role, grantee)
    }

    pub fn revoke_role(
        ctx: Context<instructions::UpdateRoles>,
        role: RoleType,
        revokee: Pubkey,
    ) -> Result<()> {
        instructions::update_roles::handle_revoke(ctx, role, revokee)
    }

    pub fn transfer_authority(
        ctx: Context<instructions::TransferAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::transfer_authority::handle_propose(ctx, new_authority)
    }

    pub fn accept_authority(ctx: Context<instructions::AcceptAuthority>) -> Result<()> {
        instructions::transfer_authority::handle_accept(ctx)
    }

    pub fn cancel_authority_transfer(
        ctx: Context<instructions::TransferAuthority>,
    ) -> Result<()> {
        instructions::transfer_authority::handle_cancel(ctx)
    }

    pub fn add_to_blacklist(
        ctx: Context<instructions::AddToBlacklist>,
        address: Pubkey,
        reason: String,
    ) -> Result<()> {
        instructions::add_to_blacklist::handler(ctx, address, reason)
    }

    pub fn remove_from_blacklist(
        ctx: Context<instructions::RemoveFromBlacklist>,
        address: Pubkey,
    ) -> Result<()> {
        instructions::remove_from_blacklist::handler(ctx, address)
    }

    pub fn seize(ctx: Context<instructions::Seize>, amount: u64) -> Result<()> {
        instructions::seize::handler(ctx, amount)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum RoleType {
    Burner,
    Pauser,
    Blacklister,
    Seizer,
}

impl std::fmt::Display for RoleType {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            RoleType::Burner => write!(f, "burner"),
            RoleType::Pauser => write!(f, "pauser"),
            RoleType::Blacklister => write!(f, "blacklister"),
            RoleType::Seizer => write!(f, "seizer"),
        }
    }
}
