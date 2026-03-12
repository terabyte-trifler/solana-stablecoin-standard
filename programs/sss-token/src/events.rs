// programs/sss-token/src/events.rs
//
// Anchor events are emitted via `emit!()` and appear in transaction logs
// as base64-encoded, discriminator-prefixed data. The TypeScript SDK and
// backend indexer can parse these using Anchor's event parser.
//
// WHY EVENTS MATTER FOR THIS PROJECT:
// 1. Audit trail — regulators want to see who did what and when
// 2. Off-chain indexing — the backend service builds queryable state from events
// 3. Webhook triggers — events fire webhooks to external compliance systems
//
// EVERY state-changing instruction must emit an event. No exceptions.
// Even if the instruction seems minor (like updating a minter's quota),
// it matters for the audit log.

use anchor_lang::prelude::*;

// ============================================================================
// INITIALIZATION EVENTS
// ============================================================================

/// Emitted when a new stablecoin is created via `initialize`.
#[event]
pub struct StablecoinInitialized {
    /// The StablecoinConfig PDA address
    pub config: Pubkey,
    /// The Token-2022 mint address
    pub mint: Pubkey,
    /// Token name
    pub name: String,
    /// Token symbol
    pub symbol: String,
    /// Number of decimals
    pub decimals: u8,
    /// "SSS-1", "SSS-2", or "custom"
    pub preset: String,
    /// The master authority that created this stablecoin
    pub authority: Pubkey,
    /// Whether permanent delegate is enabled
    pub permanent_delegate: bool,
    /// Whether transfer hook is enabled
    pub transfer_hook: bool,
    /// Timestamp of creation
    pub timestamp: i64,
}

// ============================================================================
// TOKEN OPERATION EVENTS
// ============================================================================

/// Emitted when tokens are minted.
#[event]
pub struct TokensMinted {
    pub config: Pubkey,
    pub mint: Pubkey,
    /// Who received the tokens
    pub recipient: Pubkey,
    /// Amount minted (in smallest unit, e.g., 1_000_000 = 1.0 USDC)
    pub amount: u64,
    /// Who signed the mint transaction
    pub minter: Pubkey,
    /// New total supply after minting
    pub new_total_supply: u64,
    pub timestamp: i64,
}

/// Emitted when tokens are burned.
#[event]
pub struct TokensBurned {
    pub config: Pubkey,
    pub mint: Pubkey,
    /// Amount burned
    pub amount: u64,
    /// Who signed the burn transaction
    pub burner: Pubkey,
    /// New total supply after burning
    pub new_total_supply: u64,
    pub timestamp: i64,
}

// ============================================================================
// ACCOUNT MANAGEMENT EVENTS
// ============================================================================

/// Emitted when a token account is frozen.
#[event]
pub struct AccountFrozen {
    pub config: Pubkey,
    /// The token account that was frozen
    pub token_account: Pubkey,
    /// The wallet owner of the frozen account
    pub account_owner: Pubkey,
    /// Who performed the freeze
    pub frozen_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when a token account is thawed.
#[event]
pub struct AccountThawed {
    pub config: Pubkey,
    pub token_account: Pubkey,
    pub account_owner: Pubkey,
    pub thawed_by: Pubkey,
    pub timestamp: i64,
}

// ============================================================================
// OPERATIONAL EVENTS
// ============================================================================

/// Emitted when the stablecoin is paused.
#[event]
pub struct StablecoinPaused {
    pub config: Pubkey,
    /// Who triggered the pause
    pub paused_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when the stablecoin is unpaused.
#[event]
pub struct StablecoinUnpaused {
    pub config: Pubkey,
    /// Who triggered the unpause (always master authority)
    pub unpaused_by: Pubkey,
    pub timestamp: i64,
}

// ============================================================================
// AUTHORITY EVENTS
// ============================================================================

/// Emitted when an authority transfer is proposed (step 1 of 2).
#[event]
pub struct AuthorityTransferProposed {
    pub config: Pubkey,
    /// Current master authority (who proposed)
    pub current_authority: Pubkey,
    /// Proposed new authority
    pub proposed_authority: Pubkey,
    pub timestamp: i64,
}

/// Emitted when an authority transfer is accepted (step 2 of 2).
#[event]
pub struct AuthorityTransferAccepted {
    pub config: Pubkey,
    /// Previous master authority
    pub previous_authority: Pubkey,
    /// New master authority (who accepted)
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

/// Emitted when a pending authority transfer is cancelled.
#[event]
pub struct AuthorityTransferCancelled {
    pub config: Pubkey,
    pub cancelled_by: Pubkey,
    /// The address that was pending (now cancelled)
    pub cancelled_pending: Pubkey,
    pub timestamp: i64,
}

// ============================================================================
// ROLE MANAGEMENT EVENTS
// ============================================================================

/// Emitted when a minter is added.
#[event]
pub struct MinterAdded {
    pub config: Pubkey,
    pub minter: Pubkey,
    /// Per-epoch quota assigned (0 = unlimited)
    pub quota: u64,
    pub added_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when a minter is removed.
#[event]
pub struct MinterRemoved {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when a minter's quota is updated.
#[event]
pub struct MinterQuotaUpdated {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub old_quota: u64,
    pub new_quota: u64,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

/// Generic event for adding/removing simple roles (burner, pauser, etc.)
#[event]
pub struct RoleGranted {
    pub config: Pubkey,
    /// "burner", "pauser", "blacklister", "seizer"
    pub role: String,
    /// Address that received the role
    pub grantee: Pubkey,
    pub granted_by: Pubkey,
    pub timestamp: i64,
}

/// Generic event for revoking simple roles.
#[event]
pub struct RoleRevoked {
    pub config: Pubkey,
    pub role: String,
    pub revokee: Pubkey,
    pub revoked_by: Pubkey,
    pub timestamp: i64,
}

// ============================================================================
// COMPLIANCE EVENTS (SSS-2 ONLY)
// ============================================================================

/// Emitted when an address is added to the blacklist.
#[event]
pub struct AddressBlacklisted {
    pub config: Pubkey,
    /// The wallet address that was blacklisted
    pub address: Pubkey,
    /// Compliance reason
    pub reason: String,
    /// Who performed the blacklisting
    pub blacklisted_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when an address is removed from the blacklist.
#[event]
pub struct AddressRemovedFromBlacklist {
    pub config: Pubkey,
    pub address: Pubkey,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when tokens are seized via permanent delegate.
#[event]
pub struct TokensSeized {
    pub config: Pubkey,
    pub mint: Pubkey,
    /// Token account tokens were seized from
    pub from_token_account: Pubkey,
    /// Owner of the seized token account
    pub from_owner: Pubkey,
    /// Treasury/destination token account
    pub to_token_account: Pubkey,
    /// Amount seized
    pub amount: u64,
    /// Who authorized the seizure
    pub seized_by: Pubkey,
    pub timestamp: i64,
}
