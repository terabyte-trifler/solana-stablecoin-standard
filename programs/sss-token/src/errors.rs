// programs/sss-token/src/errors.rs
//
// Anchor error codes start at 6000 (0x1770).
// Custom errors are offset from that base.
// Each variant gets a sequential code: 6000, 6001, 6002, ...
//
// Solana transactions that fail with these errors will show the
// error name and message in explorer and SDK error parsing.
//
// NAMING CONVENTION:
// - State validation errors: describe WHAT is wrong (NameTooLong)
// - Auth errors: describe WHO is unauthorized (UnauthorizedMinter)
// - Feature errors: describe WHAT feature is missing (ComplianceNotEnabled)
// - Operational errors: describe WHAT went wrong (StablecoinPaused)

use anchor_lang::prelude::*;

#[error_code]
pub enum SSSError {
    // ====================================================================
    // STRING VALIDATION ERRORS (6000–6005)
    // ====================================================================

    /// 6000 — Token name exceeds MAX_NAME_LEN (32 bytes)
    #[msg("Token name exceeds maximum length of 32 bytes")]
    NameTooLong,

    /// 6001 — Token name is empty
    #[msg("Token name cannot be empty")]
    NameEmpty,

    /// 6002 — Token symbol exceeds MAX_SYMBOL_LEN (10 bytes)
    #[msg("Token symbol exceeds maximum length of 10 bytes")]
    SymbolTooLong,

    /// 6003 — Token symbol is empty
    #[msg("Token symbol cannot be empty")]
    SymbolEmpty,

    /// 6004 — Metadata URI exceeds MAX_URI_LEN (200 bytes)
    #[msg("Metadata URI exceeds maximum length of 200 bytes")]
    UriTooLong,

    /// 6005 — Blacklist reason exceeds MAX_REASON_LEN (100 bytes)
    #[msg("Blacklist reason exceeds maximum length of 100 bytes")]
    ReasonTooLong,

    /// 6006 — Blacklist reason is empty
    #[msg("Blacklist reason cannot be empty")]
    ReasonEmpty,

    // ====================================================================
    // AUTHORIZATION ERRORS (6007–6014)
    // ====================================================================

    /// 6007 — Signer is not the master authority
    #[msg("Signer is not the master authority")]
    UnauthorizedAuthority,

    /// 6008 — Signer is not a registered minter (and not master authority)
    #[msg("Signer is not authorized to mint tokens")]
    UnauthorizedMinter,

    /// 6009 — Signer is not a registered burner (and not master authority)
    #[msg("Signer is not authorized to burn tokens")]
    UnauthorizedBurner,

    /// 6010 — Signer is not a registered pauser (and not master authority)
    #[msg("Signer is not authorized to pause operations")]
    UnauthorizedPauser,

    /// 6011 — Signer is not a registered blacklister (and not master authority)
    #[msg("Signer is not authorized to manage the blacklist")]
    UnauthorizedBlacklister,

    /// 6012 — Signer is not a registered seizer (and not master authority)
    #[msg("Signer is not authorized to seize tokens")]
    UnauthorizedSeizer,

    /// 6013 — Signer is not the pending authority (for accept_authority)
    #[msg("Signer is not the pending master authority")]
    UnauthorizedPendingAuthority,

    /// 6014 — No authority transfer is pending
    #[msg("No authority transfer is currently pending")]
    NoAuthorityTransferPending,

    // ====================================================================
    // FEATURE GATING ERRORS (6015–6017)
    // ====================================================================

    /// 6015 — SSS-2 feature called on an SSS-1 config
    /// Covers: blacklist, seize, and any compliance-only operations.
    #[msg("Compliance features are not enabled (requires SSS-2 preset)")]
    ComplianceNotEnabled,

    /// 6016 — Permanent delegate not enabled (needed for seize)
    #[msg("Permanent delegate extension not enabled on this mint")]
    PermanentDelegateNotEnabled,

    /// 6017 — Transfer hook not enabled (needed for blacklist enforcement)
    #[msg("Transfer hook extension not enabled on this mint")]
    TransferHookNotEnabled,

    // ====================================================================
    // OPERATIONAL ERRORS (6018–6025)
    // ====================================================================

    /// 6018 — Operation blocked because stablecoin is paused
    #[msg("Stablecoin operations are currently paused")]
    StablecoinPaused,

    /// 6019 — Stablecoin is already paused
    #[msg("Stablecoin is already paused")]
    AlreadyPaused,

    /// 6020 — Stablecoin is not paused (can't unpause what's not paused)
    #[msg("Stablecoin is not currently paused")]
    NotPaused,

    /// 6021 — Amount must be greater than zero
    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    /// 6022 — Arithmetic overflow in checked math
    #[msg("Arithmetic overflow")]
    MathOverflow,

    /// 6023 — Decimals out of valid range (0–9)
    /// Solana convention: stablecoins use 6, but we allow 0–9.
    /// Token-2022 supports up to 255, but >9 is impractical for stables.
    #[msg("Decimals must be between 0 and 9")]
    InvalidDecimals,

    // ====================================================================
    // ROLE MANAGEMENT ERRORS (6024–6027)
    // ====================================================================

    /// 6024 — Trying to add a role that already exists
    #[msg("This address already has the specified role")]
    RoleAlreadyAssigned,

    /// 6025 — Trying to remove a role that doesn't exist
    #[msg("This address does not have the specified role")]
    RoleNotFound,

    /// 6026 — Vector is at max capacity (e.g., 20 minters already)
    #[msg("Maximum number of entries for this role has been reached")]
    RoleLimitExceeded,

    /// 6027 — Minter would exceed their per-epoch quota
    #[msg("Minting this amount would exceed the minter's epoch quota")]
    MinterQuotaExceeded,

    // ====================================================================
    // BLACKLIST ERRORS (6028–6030)
    // ====================================================================

    /// 6028 — Address is already blacklisted
    #[msg("This address is already blacklisted")]
    AlreadyBlacklisted,

    /// 6029 — Address is not blacklisted (can't remove what's not there)
    #[msg("This address is not on the blacklist")]
    NotBlacklisted,

    /// 6030 — Transfer blocked because sender or receiver is blacklisted
    /// This error is returned by the transfer hook program.
    #[msg("Transfer blocked: address is blacklisted")]
    AddressBlacklisted,

    // ====================================================================
    // MINT / TOKEN ERRORS (6031–6033)
    // ====================================================================

    /// 6031 — Invalid mint account (doesn't match config)
    #[msg("Mint account does not match the stablecoin configuration")]
    InvalidMint,

    /// 6032 — Token account mint doesn't match expected mint
    #[msg("Token account is not associated with this stablecoin's mint")]
    InvalidTokenAccount,

    /// 6033 — Insufficient token balance for the operation
    #[msg("Insufficient token balance")]
    InsufficientBalance,
}
