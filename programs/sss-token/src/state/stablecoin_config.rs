// programs/sss-token/src/state/stablecoin_config.rs
//
// ┌─────────────────────────────────────────────────────────────────┐
// │                      StablecoinConfig                          │
// │                                                                 │
// │  This is THE central account for a stablecoin instance.        │
// │  Every instruction in the program reads from this account      │
// │  to check pause state, feature flags, and authority.           │
// │                                                                 │
// │  PDA: ["stablecoin", mint_pubkey]                              │
// │  One StablecoinConfig per mint. The mint pubkey is embedded    │
// │  in the seed so you can never have two configs for one mint.   │
// │                                                                 │
// │  CREATED BY: `initialize` instruction                          │
// │  MUTATED BY: `mint`, `burn`, `pause`, `unpause`,              │
// │              `transfer_authority`, `accept_authority`           │
// │  READ BY:    every other instruction (for auth/pause checks)   │
// └─────────────────────────────────────────────────────────────────┘

use anchor_lang::prelude::*;

use crate::constants::*;

/// The core configuration account for a stablecoin instance.
///
/// # Design Decisions
///
/// **Why track `total_supply` manually?**
/// Token-2022 stores supply on the Mint account, but reading it requires
/// deserializing the full Mint (which includes extension data and is expensive
/// in compute units). By tracking supply ourselves, any instruction or
/// off-chain reader can get the supply from this small account without
/// touching the Mint. We accept the consistency responsibility — every mint
/// instruction increments, every burn decrements, nothing else touches it.
///
/// **Why `pending_master_authority` exists (two-step transfer):**
/// Single-step authority transfer is dangerous. If you typo the new authority,
/// you lose the stablecoin forever. Two-step: current authority proposes (sets
/// `pending_master_authority = Some(new_addr)`), then the new authority calls
/// `accept_authority` to finalize. If the proposed address is wrong, the old
/// authority can re-propose or cancel.
///
/// **Why feature flags are immutable:**
/// Token-2022 extensions are set at mint creation and cannot be added later.
/// If `enable_transfer_hook` is false at init, the mint has no hook extension,
/// so enabling it later is physically impossible. The config flags mirror the
/// mint's actual extension state — they're immutable because the underlying
/// extensions are immutable.
#[account]
pub struct StablecoinConfig {
    // ====================================================================
    // IDENTITY — set once at initialization, never changes
    // ====================================================================

    /// Human-readable name of the stablecoin (e.g., "USD Coin")
    /// Also written to the Token-2022 Metadata extension on the mint.
    /// Max length: MAX_NAME_LEN (32 bytes). Enforced in `initialize`.
    pub name: String,

    /// Ticker symbol (e.g., "USDC", "MYUSD")
    /// Also written to Token-2022 Metadata.
    /// Max length: MAX_SYMBOL_LEN (10 bytes). Enforced in `initialize`.
    pub symbol: String,

    /// URI pointing to off-chain JSON metadata (image, description, etc.)
    /// Typically an Arweave or IPFS link.
    /// Max length: MAX_URI_LEN (200 bytes). Enforced in `initialize`.
    pub uri: String,

    /// Number of decimal places (typically 6 for stablecoins on Solana).
    /// Set on the Token-2022 mint and stored here for convenient reads.
    /// USDC uses 6, USDT uses 6, but the SDK allows any value 0–9.
    pub decimals: u8,

    // ====================================================================
    // MINT REFERENCE
    // ====================================================================

    /// The Token-2022 mint address this config governs.
    /// Stored explicitly so any instruction can verify it's operating on
    /// the correct mint without re-deriving the PDA.
    pub mint: Pubkey,

    // ====================================================================
    // FEATURE FLAGS — set at init, IMMUTABLE after that
    // ====================================================================
    // These flags mirror the Token-2022 extensions actually present on the
    // mint. They exist so instruction handlers can gate SSS-2 features
    // without needing to deserialize the mint's extension data.
    //
    // Example: the `seize` instruction checks `enable_permanent_delegate`
    // before attempting a delegate transfer. If false, it returns
    // SSSError::FeatureNotEnabled instead of failing with a confusing
    // Token-2022 error.

    /// Whether the PermanentDelegate extension is enabled on the mint.
    /// Required for SSS-2 `seize` instruction (clawback/asset recovery).
    /// When true, the StablecoinConfig PDA is the permanent delegate and
    /// can transfer tokens from ANY token account of this mint.
    pub enable_permanent_delegate: bool,

    /// Whether the TransferHook extension is enabled on the mint.
    /// Required for SSS-2 blacklist enforcement. When true, every
    /// `transfer_checked` call on this mint triggers the sss-transfer-hook
    /// program, which checks the sender and receiver against blacklist PDAs.
    pub enable_transfer_hook: bool,

    /// Whether new token accounts start frozen by default.
    /// Uses Token-2022's DefaultAccountState extension.
    /// When true, recipients must be explicitly thawed before they can
    /// receive transfers. Useful for strict compliance regimes where
    /// every participant must be KYC-approved before transacting.
    pub default_account_frozen: bool,

    // ====================================================================
    // OPERATIONAL STATE — changes during the stablecoin's lifetime
    // ====================================================================

    /// Global pause switch. When true, ALL minting, burning, freezing,
    /// thawing, blacklisting, and seizing operations are blocked.
    /// Only `unpause` and `transfer_authority` still work while paused.
    ///
    /// NOTE: This does NOT pause transfers between users. Token transfers
    /// are handled by Token-2022 directly — we can't intercept them with
    /// a program flag. To halt transfers, you'd need to freeze individual
    /// accounts or use the transfer hook to check pause state (but that
    /// adds CPI overhead to every transfer).
    pub is_paused: bool,

    /// Manually tracked total supply of outstanding tokens.
    ///
    /// INVARIANT: This must always equal the mint's actual supply.
    /// - `mint` instruction: total_supply += amount
    /// - `burn` instruction: total_supply -= amount
    /// - `seize` instruction: does NOT change supply (it's a transfer)
    /// - No other instruction modifies this field.
    ///
    /// If this ever drifts from the Mint's supply (e.g., due to a bug),
    /// a `sync_supply` instruction can be added to re-read the mint.
    pub total_supply: u64,

    // ====================================================================
    // AUTHORITY — who controls this stablecoin
    // ====================================================================

    /// The master authority — the top-level admin key.
    /// Can: add/remove all roles, pause/unpause, transfer authority.
    /// This is typically a multisig in production.
    ///
    /// IMPORTANT: The master authority is NOT the same as the mint authority
    /// or freeze authority. Those are set to this PDA (StablecoinConfig),
    /// which the program controls. The master_authority is the human/multisig
    /// that signs transactions to operate the stablecoin.
    pub master_authority: Pubkey,

    /// Pending authority for two-step transfer.
    ///
    /// Flow:
    /// 1. Current master calls `transfer_authority(new_addr)` →
    ///    sets pending_master_authority = Some(new_addr)
    /// 2. New address calls `accept_authority()` →
    ///    sets master_authority = new_addr, pending = None
    ///
    /// To cancel: current master calls `transfer_authority(current_master)`
    /// which resets pending to None (or a dedicated cancel instruction).
    ///
    /// WHY Option<Pubkey>:
    /// - None = no transfer in progress
    /// - Some(addr) = transfer proposed, waiting for acceptance
    /// - Costs 1 extra byte vs always storing a Pubkey (the Option tag)
    pub pending_master_authority: Option<Pubkey>,

    // ====================================================================
    // PDA METADATA
    // ====================================================================

    /// The PDA bump seed. Stored so we never need to re-derive it.
    /// Anchor sets this automatically via `bump = config.bump` in
    /// seeds constraints. Saves ~4000 compute units per instruction
    /// vs calling `find_program_address` every time.
    pub bump: u8,
}

impl StablecoinConfig {
    /// Returns the PDA seeds for signing CPIs (e.g., minting tokens).
    ///
    /// Usage in instruction handler:
    /// ```ignore
    /// let signer_seeds = config.as_signer_seeds(&mint_key);
    /// let signer = &[&signer_seeds[..]];
    /// // ... CPI with signer
    /// ```
    ///
    /// We return a fixed-size array so it can be borrowed as `&[&[u8]]`
    /// without allocating. The lifetime ties to the input references.
    pub fn as_signer_seeds<'a>(&'a self, mint: &'a Pubkey) -> [&'a [u8]; 3] {
        [
            STABLECOIN_SEED,
            mint.as_ref(),
            std::slice::from_ref(&self.bump),
        ]
    }

    /// Check if this config represents an SSS-2 (compliant) stablecoin.
    /// SSS-2 requires BOTH permanent delegate and transfer hook.
    pub fn is_compliant(&self) -> bool {
        self.enable_permanent_delegate && self.enable_transfer_hook
    }

    /// Check if an SSS-2 feature is available. Used in instruction guards.
    /// Returns Ok(()) if the feature is enabled, Err if not.
    ///
    /// Usage:
    /// ```ignore
    /// config.require_feature(config.enable_transfer_hook, "transfer_hook")?;
    /// ```
    pub fn require_compliance(&self) -> Result<()> {
        require!(
            self.is_compliant(),
            crate::errors::SSSError::ComplianceNotEnabled
        );
        Ok(())
    }

    /// Check that the stablecoin is not paused. Called at the top of
    /// every state-mutating instruction (except unpause/transfer_authority).
    pub fn require_not_paused(&self) -> Result<()> {
        require!(
            !self.is_paused,
            crate::errors::SSSError::StablecoinPaused
        );
        Ok(())
    }

    /// Validate that a string field doesn't exceed its max length.
    /// Called during initialization to prevent oversized accounts.
    pub fn validate_string_lengths(
        name: &str,
        symbol: &str,
        uri: &str,
    ) -> Result<()> {
        require!(
            name.len() <= MAX_NAME_LEN,
            crate::errors::SSSError::NameTooLong
        );
        require!(
            symbol.len() <= MAX_SYMBOL_LEN,
            crate::errors::SSSError::SymbolTooLong
        );
        require!(
            uri.len() <= MAX_URI_LEN,
            crate::errors::SSSError::UriTooLong
        );
        // Also ensure they're not empty
        require!(
            !name.is_empty(),
            crate::errors::SSSError::NameEmpty
        );
        require!(
            !symbol.is_empty(),
            crate::errors::SSSError::SymbolEmpty
        );
        Ok(())
    }
}
