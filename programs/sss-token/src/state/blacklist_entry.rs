// programs/sss-token/src/state/blacklist_entry.rs
//
// ┌─────────────────────────────────────────────────────────────────┐
// │                       BlacklistEntry                           │
// │                                                                 │
// │  SSS-2 ONLY. Represents a blacklisted wallet address.         │
// │                                                                 │
// │  PDA: ["blacklist", stablecoin_config_pubkey, wallet_pubkey]   │
// │                                                                 │
// │  EXISTENCE = BLACKLISTED:                                       │
// │  If this PDA account exists, the wallet is blacklisted.        │
// │  If it doesn't exist, the wallet is not blacklisted.           │
// │  Removing from blacklist = closing this account.               │
// │                                                                 │
// │  CREATED BY: `add_to_blacklist` instruction                    │
// │  CLOSED BY:  `remove_from_blacklist` instruction               │
// │  READ BY:    `sss-transfer-hook` program (on every transfer)   │
// └─────────────────────────────────────────────────────────────────┘
//
// ┌────────────────────────────────────────────────────────────────┐
// │  CRITICAL POLICY DECISION: What do we blacklist?              │
// │                                                                │
// │  We blacklist WALLET OWNER addresses, not token accounts.     │
// │                                                                │
// │  Why?                                                          │
// │  1. A single wallet can own unlimited token accounts. If we   │
// │     blacklisted token accounts, an attacker could just create │
// │     a new one and transfer tokens to it.                      │
// │                                                                │
// │  2. Regulatory sanctions (OFAC SDN list, etc.) identify       │
// │     wallet addresses, not individual token accounts.          │
// │                                                                │
// │  3. The transfer hook receives both source and destination    │
// │     token accounts. From these, it can derive the owner       │
// │     (stored in the token account data) and check the          │
// │     blacklist PDA for that owner.                             │
// │                                                                │
// │  Implication: When we blacklist wallet W, ALL token accounts  │
// │  owned by W are blocked from sending or receiving this        │
// │  stablecoin. W cannot create a new token account to escape.  │
// └────────────────────────────────────────────────────────────────┘

use anchor_lang::prelude::*;

use crate::constants::*;

/// A record of a blacklisted wallet address.
///
/// # How the Transfer Hook Uses This
///
/// The sss-transfer-hook program is invoked on every `transfer_checked`
/// call for the SSS-2 mint. The hook:
///
/// 1. Receives the source token account, destination token account, and
///    this program's extra account metas (which include the blacklist PDAs).
/// 2. For both source owner and destination owner, derives the BlacklistEntry
///    PDA: `["blacklist", config, owner]`.
/// 3. Checks if the PDA account has data (exists and is initialized).
///    - If either PDA exists → the transfer is REJECTED.
///    - If neither exists → the transfer proceeds normally.
///
/// This "existence check" pattern is efficient: no deserialization needed,
/// just check `account.data_len() > 0` or use `try_borrow_data()`.
///
/// # Audit Trail
///
/// Each entry stores who blacklisted the address and when, creating
/// an immutable on-chain audit trail. The `reason` field holds the
/// compliance rationale (e.g., "OFAC SDN match", "Court order #789").
///
/// Even after removal (account closure), the event log retains the
/// `AddressBlacklisted` and `AddressRemovedFromBlacklist` events
/// permanently in Solana's ledger history.
#[account]
pub struct BlacklistEntry {
    /// The StablecoinConfig this blacklist entry belongs to.
    /// Stored for cross-validation — ensures this entry can only be
    /// used with the correct stablecoin instance.
    pub stablecoin: Pubkey,

    /// The blacklisted wallet owner address.
    ///
    /// This is the OWNER of token accounts, not a token account itself.
    /// When the transfer hook checks blacklist status, it reads the owner
    /// field from the source/destination token accounts and looks up
    /// this PDA using that owner address.
    ///
    /// Format: a standard Solana wallet address (ed25519 public key).
    /// Could be a regular wallet, a multisig, or even a PDA (if a program
    /// owns token accounts and needs to be sanctioned).
    pub address: Pubkey,

    /// Human-readable reason for blacklisting.
    ///
    /// Examples:
    /// - "OFAC SDN match — address identified in sanctions list update 2025-03-01"
    /// - "Court order #12345 — asset freeze ordered by District Court"
    /// - "Internal compliance — suspicious activity flagged by monitoring"
    ///
    /// Max length: MAX_REASON_LEN (100 bytes).
    /// This field is informational — the transfer hook doesn't read it.
    /// It exists for operators and auditors reviewing the blacklist.
    pub reason: String,

    /// Unix timestamp (seconds) when this address was blacklisted.
    /// Set from `Clock::get()?.unix_timestamp` during `add_to_blacklist`.
    /// Used for audit trail and compliance reporting.
    pub blacklisted_at: i64,

    /// The wallet that performed the blacklisting action.
    /// Must be a registered blacklister or the master authority.
    /// Stored for accountability — "who made this decision?"
    pub blacklisted_by: Pubkey,

    /// PDA bump seed.
    pub bump: u8,
}

impl BlacklistEntry {
    /// Returns the PDA seeds for this blacklist entry.
    /// Used when the program needs to sign as the PDA (rarely needed
    /// for blacklist, but included for consistency).
    pub fn seeds<'a>(
        stablecoin: &'a Pubkey,
        address: &'a Pubkey,
        bump: &'a u8,
    ) -> [&'a [u8]; 4] {
        [
            BLACKLIST_SEED,
            stablecoin.as_ref(),
            address.as_ref(),
            std::slice::from_ref(bump),
        ]
    }

    /// Validate the reason string length during creation.
    pub fn validate_reason(reason: &str) -> Result<()> {
        require!(
            reason.len() <= MAX_REASON_LEN,
            crate::errors::SSSError::ReasonTooLong
        );
        require!(
            !reason.is_empty(),
            crate::errors::SSSError::ReasonEmpty
        );
        Ok(())
    }
}
