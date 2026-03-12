// programs/sss-token/src/lib.rs
//
// ┌──────────────────────────────────────────────────────────────────┐
// │           Solana Stablecoin Standard (SSS) — Main Program       │
// │                                                                  │
// │  A single configurable program that supports both presets        │
// │  (SSS-1 Minimal, SSS-2 Compliant) via initialization params.   │
// │                                                                  │
// │  SSS-1: Mint + freeze authority + metadata. The basics.         │
// │  SSS-2: SSS-1 + permanent delegate + transfer hook + blacklist. │
// │                                                                  │
// │  The program uses Token-2022 (Token Extensions Program) for     │
// │  the underlying mint, not the legacy SPL Token program.         │
// └──────────────────────────────────────────────────────────────────┘

use anchor_lang::prelude::*;

// Module declarations
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// Re-export commonly used types for external consumers (SDK, tests)
pub use constants::*;
pub use errors::*;
pub use state::*;

// Program ID — replace with your actual deployed program ID.
// Generate one with: `solana-keygen grind --starts-with SSS:1`
// For local development, Anchor generates a keypair in target/deploy/
declare_id!("SSS1TokenXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

/// The SSS Token program.
///
/// All instructions are defined here. Each delegates to a handler
/// function in the `instructions` module.
///
/// NAMING CONVENTION:
/// - Snake_case function names match the instruction discriminator
/// - Each function takes a Context<T> where T is the Accounts struct
/// - Additional parameters come from the instruction data
#[program]
pub mod sss_token {
    use super::*;

    // =================================================================
    // CORE INSTRUCTIONS (SSS-1 + SSS-2)
    // =================================================================
    // These will be implemented in Phase 1.3. Signatures shown here
    // as the API contract.

    // pub fn initialize(
    //     ctx: Context<Initialize>,
    //     name: String,
    //     symbol: String,
    //     uri: String,
    //     decimals: u8,
    //     enable_permanent_delegate: bool,
    //     enable_transfer_hook: bool,
    //     default_account_frozen: bool,
    // ) -> Result<()> {
    //     instructions::initialize::handler(
    //         ctx, name, symbol, uri, decimals,
    //         enable_permanent_delegate, enable_transfer_hook,
    //         default_account_frozen,
    //     )
    // }

    // pub fn mint(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    //     instructions::mint::handler(ctx, amount)
    // }

    // pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    //     instructions::burn::handler(ctx, amount)
    // }

    // pub fn freeze_account(ctx: Context<FreezeAccount>) -> Result<()> {
    //     instructions::freeze::handler(ctx)
    // }

    // pub fn thaw_account(ctx: Context<ThawAccount>) -> Result<()> {
    //     instructions::thaw::handler(ctx)
    // }

    // pub fn pause(ctx: Context<Pause>) -> Result<()> {
    //     instructions::pause::handler(ctx)
    // }

    // pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
    //     instructions::unpause::handler(ctx)
    // }

    // pub fn add_minter(
    //     ctx: Context<UpdateMinter>,
    //     minter: Pubkey,
    //     quota: u64,
    // ) -> Result<()> {
    //     instructions::update_minter::handle_add(ctx, minter, quota)
    // }

    // pub fn remove_minter(
    //     ctx: Context<UpdateMinter>,
    //     minter: Pubkey,
    // ) -> Result<()> {
    //     instructions::update_minter::handle_remove(ctx, minter)
    // }

    // pub fn update_minter_quota(
    //     ctx: Context<UpdateMinter>,
    //     minter: Pubkey,
    //     new_quota: u64,
    // ) -> Result<()> {
    //     instructions::update_minter::handle_update_quota(ctx, minter, new_quota)
    // }

    // pub fn grant_role(
    //     ctx: Context<UpdateRoles>,
    //     role: RoleType,
    //     grantee: Pubkey,
    // ) -> Result<()> {
    //     instructions::update_roles::handle_grant(ctx, role, grantee)
    // }

    // pub fn revoke_role(
    //     ctx: Context<UpdateRoles>,
    //     role: RoleType,
    //     revokee: Pubkey,
    // ) -> Result<()> {
    //     instructions::update_roles::handle_revoke(ctx, role, revokee)
    // }

    // pub fn transfer_authority(
    //     ctx: Context<TransferAuthority>,
    //     new_authority: Pubkey,
    // ) -> Result<()> {
    //     instructions::transfer_authority::handle_propose(ctx, new_authority)
    // }

    // pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    //     instructions::transfer_authority::handle_accept(ctx)
    // }

    // pub fn cancel_authority_transfer(
    //     ctx: Context<TransferAuthority>,
    // ) -> Result<()> {
    //     instructions::transfer_authority::handle_cancel(ctx)
    // }

    // =================================================================
    // SSS-2 COMPLIANCE INSTRUCTIONS
    // =================================================================

    // pub fn add_to_blacklist(
    //     ctx: Context<AddToBlacklist>,
    //     address: Pubkey,
    //     reason: String,
    // ) -> Result<()> {
    //     instructions::add_to_blacklist::handler(ctx, address, reason)
    // }

    // pub fn remove_from_blacklist(
    //     ctx: Context<RemoveFromBlacklist>,
    //     address: Pubkey,
    // ) -> Result<()> {
    //     instructions::remove_from_blacklist::handler(ctx, address)
    // }

    // pub fn seize(ctx: Context<Seize>, amount: u64) -> Result<()> {
    //     instructions::seize::handler(ctx, amount)
    // }
}

/// Role types used in the `grant_role` and `revoke_role` instructions.
/// Minter is handled separately because it has quota parameters.
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
