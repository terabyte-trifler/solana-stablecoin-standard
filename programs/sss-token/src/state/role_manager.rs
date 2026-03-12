// programs/sss-token/src/state/role_manager.rs
//
// ┌─────────────────────────────────────────────────────────────────┐
// │                        RoleManager                             │
// │                                                                 │
// │  Stores every operator role for a stablecoin instance.         │
// │  No single key controls everything — the master authority      │
// │  grants specific roles to specific addresses.                  │
// │                                                                 │
// │  PDA: ["roles", stablecoin_config_pubkey]                      │
// │  One RoleManager per StablecoinConfig.                         │
// │                                                                 │
// │  CREATED BY: `initialize` instruction (alongside config)       │
// │  MUTATED BY: `update_minter`, `update_roles`                   │
// │  READ BY:    `mint`, `burn`, `pause`, `blacklist`, `seize`     │
// │              (to check if the signer has the required role)    │
// └─────────────────────────────────────────────────────────────────┘
//
// DESIGN NOTE — Why one account instead of separate PDAs per role?
//
// Option A: One RoleManager account with Vecs (what we chose)
//   + Fewer accounts to pass in instructions
//   + Simpler init (one PDA instead of five)
//   + Atomic role reads (one account fetch gets all roles)
//   - Max ~60 total role entries before account gets large
//   - All role mutations serialize/deserialize the full account
//
// Option B: Separate PDA per role assignment
//   + Scales to thousands of operators
//   + Each mutation only touches one small account
//   - Every instruction needs more accounts passed in
//   - Checking "is X a minter?" requires fetching a specific PDA
//   - More complex init and enumeration
//
// For a stablecoin SDK (not DeFi protocol with thousands of operators),
// ~60 role slots is more than enough. We chose simplicity.

use anchor_lang::prelude::*;

use crate::constants::*;

/// A single minter's configuration, including quota tracking.
///
/// # Quota System
///
/// Each minter has an independent quota that limits how much they can mint
/// per Solana epoch (~2.5 days). This prevents a single compromised minter
/// key from minting unlimited tokens.
///
/// **How quota resets work:**
/// - `quota` is the maximum amount this minter can mint per epoch
/// - `minted` tracks how much they've minted in the current epoch
/// - `last_reset_epoch` records which epoch `minted` was last reset in
/// - When a minter calls `mint`, the handler checks:
///   1. Is `current_epoch > last_reset_epoch`? If yes, reset `minted = 0`
///      and set `last_reset_epoch = current_epoch` (automatic reset)
///   2. Would `minted + amount > quota`? If yes, reject.
///   3. Otherwise, `minted += amount` and proceed.
///
/// **No manual reset needed** — the reset is triggered lazily during the
/// next mint attempt after an epoch boundary. This means no cron job and
/// no separate "reset_quotas" instruction.
///
/// **Quota of 0 means unlimited** — useful for the master authority or
/// trusted operators who shouldn't have artificial limits. Instruction
/// handlers check: `if entry.quota > 0 { enforce_quota() }`.
///
/// **Quota of u64::MAX effectively means unlimited** — but we use 0 as the
/// sentinel for clarity. Both are documented.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct MinterEntry {
    /// The wallet address authorized to mint
    pub address: Pubkey,

    /// Maximum tokens this minter can mint per epoch.
    /// 0 = unlimited (no quota enforcement).
    pub quota: u64,

    /// Tokens minted so far in the current epoch.
    /// Reset to 0 when `last_reset_epoch < current_epoch`.
    pub minted: u64,

    /// The Solana epoch in which `minted` was last reset.
    /// Used for lazy quota reset — no cron job needed.
    pub last_reset_epoch: u64,
}

impl MinterEntry {
    /// Check if this minter can mint `amount` more tokens in the current epoch.
    /// Performs lazy epoch reset if needed.
    ///
    /// Returns the updated minted amount (caller must save it back).
    ///
    /// # Arguments
    /// * `amount` - tokens to mint
    /// * `current_epoch` - from `Clock::get()?.epoch`
    ///
    /// # Errors
    /// * `SSSError::MinterQuotaExceeded` if minting would exceed quota
    pub fn check_and_update_quota(
        &mut self,
        amount: u64,
        current_epoch: u64,
    ) -> Result<()> {
        // Lazy epoch reset: if we've crossed into a new epoch, reset the counter
        if current_epoch > self.last_reset_epoch {
            self.minted = 0;
            self.last_reset_epoch = current_epoch;
        }

        // Quota of 0 means unlimited — skip enforcement
        if self.quota == 0 {
            self.minted = self.minted
                .checked_add(amount)
                .ok_or(crate::errors::SSSError::MathOverflow)?;
            return Ok(());
        }

        // Check if minting `amount` would exceed quota
        let new_minted = self.minted
            .checked_add(amount)
            .ok_or(crate::errors::SSSError::MathOverflow)?;

        require!(
            new_minted <= self.quota,
            crate::errors::SSSError::MinterQuotaExceeded
        );

        self.minted = new_minted;
        Ok(())
    }

    /// Remaining quota for the current epoch.
    /// Returns u64::MAX if quota is unlimited (0).
    pub fn remaining_quota(&self, current_epoch: u64) -> u64 {
        if self.quota == 0 {
            return u64::MAX;
        }

        // If epoch has changed, full quota is available
        if current_epoch > self.last_reset_epoch {
            return self.quota;
        }

        // Otherwise, remaining = quota - minted (saturating to avoid underflow)
        self.quota.saturating_sub(self.minted)
    }
}

/// Manages all operator roles for a stablecoin instance.
///
/// # Role Descriptions
///
/// | Role | Can Do | SSS-1 | SSS-2 |
/// |------|--------|-------|-------|
/// | Minter | Mint new tokens (within quota) | ✅ | ✅ |
/// | Burner | Burn tokens from own account | ✅ | ✅ |
/// | Pauser | Pause stablecoin operations | ✅ | ✅ |
/// | Blacklister | Add/remove addresses from blacklist | ❌ | ✅ |
/// | Seizer | Seize tokens via permanent delegate | ❌ | ✅ |
///
/// The master_authority (stored on StablecoinConfig) implicitly has ALL roles.
/// It can also add/remove entries from any role vector.
///
/// # Why Pubkey Vectors for simple roles?
///
/// Minters need quota tracking, so they get a custom struct (MinterEntry).
/// All other roles just need to answer "is address X authorized?" — a Vec<Pubkey>
/// is the simplest way to do that. We search linearly, which is fine for ≤10
/// entries (~320ns for 10 comparisons on Solana's runtime).
#[account]
pub struct RoleManager {
    /// Points back to the StablecoinConfig this RoleManager belongs to.
    /// Used for validation: the RoleManager PDA is derived from the config,
    /// but we store the reference explicitly for cross-checks.
    pub stablecoin: Pubkey,

    /// Minters: can call `mint` instruction. Each has independent quota.
    /// Max: MAX_MINTERS (20).
    /// The master_authority can always mint regardless of this list.
    pub minters: Vec<MinterEntry>,

    /// Burners: can call `burn` instruction on their own token accounts.
    /// Max: MAX_BURNERS (10).
    /// The master_authority can always burn regardless.
    pub burners: Vec<Pubkey>,

    /// Pausers: can call `pause` instruction.
    /// Max: MAX_PAUSERS (10).
    /// NOTE: Only the master_authority can call `unpause` — pausers can
    /// halt operations but can't resume them. This is a safety net: if a
    /// pauser key is compromised, the attacker can only pause (safe), not
    /// unpause (which would require the master key).
    pub pausers: Vec<Pubkey>,

    /// Blacklisters (SSS-2 only): can call `add_to_blacklist` and
    /// `remove_from_blacklist`. Max: MAX_BLACKLISTERS (10).
    /// On SSS-1 configs, this vector is always empty and any attempt
    /// to add entries will fail with ComplianceNotEnabled.
    pub blacklisters: Vec<Pubkey>,

    /// Seizers (SSS-2 only): can call `seize` instruction.
    /// Max: MAX_SEIZERS (10).
    /// On SSS-1 configs, this vector is always empty.
    /// Seize is the most destructive operation (moves tokens from any
    /// account), so it should be a very small, tightly controlled group.
    pub seizers: Vec<Pubkey>,

    /// PDA bump seed
    pub bump: u8,
}

impl RoleManager {
    // ====================================================================
    // ROLE CHECK METHODS
    // ====================================================================
    // Each returns true if the given address has the specified role.
    // The master_authority (from StablecoinConfig) is always authorized
    // for everything — callers should check master_authority FIRST,
    // then fall back to these role checks.

    /// Check if `address` is a registered minter.
    /// Returns Some(&mut MinterEntry) if found, None otherwise.
    /// The caller gets a mutable reference so they can update quota tracking.
    pub fn find_minter_mut(&mut self, address: &Pubkey) -> Option<&mut MinterEntry> {
        self.minters.iter_mut().find(|m| m.address == *address)
    }

    /// Check if `address` is a registered minter (immutable).
    pub fn is_minter(&self, address: &Pubkey) -> bool {
        self.minters.iter().any(|m| m.address == *address)
    }

    /// Check if `address` is a registered burner.
    pub fn is_burner(&self, address: &Pubkey) -> bool {
        self.burners.iter().any(|a| a == address)
    }

    /// Check if `address` is a registered pauser.
    pub fn is_pauser(&self, address: &Pubkey) -> bool {
        self.pausers.iter().any(|a| a == address)
    }

    /// Check if `address` is a registered blacklister (SSS-2).
    pub fn is_blacklister(&self, address: &Pubkey) -> bool {
        self.blacklisters.iter().any(|a| a == address)
    }

    /// Check if `address` is a registered seizer (SSS-2).
    pub fn is_seizer(&self, address: &Pubkey) -> bool {
        self.seizers.iter().any(|a| a == address)
    }

    // ====================================================================
    // ROLE MUTATION METHODS
    // ====================================================================
    // Each enforces the max count and returns a clear error if exceeded.
    // These are called by `update_minter` and `update_roles` instructions.

    /// Add a new minter with the given quota.
    /// Fails if minter already exists or max count reached.
    pub fn add_minter(
        &mut self,
        address: Pubkey,
        quota: u64,
    ) -> Result<()> {
        require!(
            !self.is_minter(&address),
            crate::errors::SSSError::RoleAlreadyAssigned
        );
        require!(
            self.minters.len() < MAX_MINTERS,
            crate::errors::SSSError::RoleLimitExceeded
        );

        self.minters.push(MinterEntry {
            address,
            quota,
            minted: 0,
            last_reset_epoch: 0, // Will reset on first mint
        });
        Ok(())
    }

    /// Remove a minter by address. Fails if not found.
    pub fn remove_minter(&mut self, address: &Pubkey) -> Result<()> {
        let index = self.minters
            .iter()
            .position(|m| m.address == *address)
            .ok_or(crate::errors::SSSError::RoleNotFound)?;

        self.minters.swap_remove(index);
        Ok(())
    }

    /// Update a minter's quota. Does NOT reset their minted counter.
    pub fn update_minter_quota(
        &mut self,
        address: &Pubkey,
        new_quota: u64,
    ) -> Result<()> {
        let entry = self.find_minter_mut(address)
            .ok_or(crate::errors::SSSError::RoleNotFound)?;
        entry.quota = new_quota;
        Ok(())
    }

    /// Add an address to a simple role vector (burner/pauser/blacklister/seizer).
    /// Enforces the max count for that role.
    pub fn add_to_role(
        role_vec: &mut Vec<Pubkey>,
        address: Pubkey,
        max_count: usize,
    ) -> Result<()> {
        require!(
            !role_vec.contains(&address),
            crate::errors::SSSError::RoleAlreadyAssigned
        );
        require!(
            role_vec.len() < max_count,
            crate::errors::SSSError::RoleLimitExceeded
        );

        role_vec.push(address);
        Ok(())
    }

    /// Remove an address from a simple role vector.
    pub fn remove_from_role(
        role_vec: &mut Vec<Pubkey>,
        address: &Pubkey,
    ) -> Result<()> {
        let index = role_vec
            .iter()
            .position(|a| a == address)
            .ok_or(crate::errors::SSSError::RoleNotFound)?;

        role_vec.swap_remove(index);
        Ok(())
    }

    // ====================================================================
    // CONVENIENCE WRAPPERS
    // ====================================================================
    // These call add_to_role / remove_from_role with the correct vector
    // and max count. Keeps instruction handler code clean.

    pub fn add_burner(&mut self, address: Pubkey) -> Result<()> {
        Self::add_to_role(&mut self.burners, address, MAX_BURNERS)
    }

    pub fn remove_burner(&mut self, address: &Pubkey) -> Result<()> {
        Self::remove_from_role(&mut self.burners, address)
    }

    pub fn add_pauser(&mut self, address: Pubkey) -> Result<()> {
        Self::add_to_role(&mut self.pausers, address, MAX_PAUSERS)
    }

    pub fn remove_pauser(&mut self, address: &Pubkey) -> Result<()> {
        Self::remove_from_role(&mut self.pausers, address)
    }

    pub fn add_blacklister(&mut self, address: Pubkey) -> Result<()> {
        Self::add_to_role(&mut self.blacklisters, address, MAX_BLACKLISTERS)
    }

    pub fn remove_blacklister(&mut self, address: &Pubkey) -> Result<()> {
        Self::remove_from_role(&mut self.blacklisters, address)
    }

    pub fn add_seizer(&mut self, address: Pubkey) -> Result<()> {
        Self::add_to_role(&mut self.seizers, address, MAX_SEIZERS)
    }

    pub fn remove_seizer(&mut self, address: &Pubkey) -> Result<()> {
        Self::remove_from_role(&mut self.seizers, address)
    }
}
