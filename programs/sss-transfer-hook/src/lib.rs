// programs/sss-transfer-hook/src/lib.rs
//
// ┌──────────────────────────────────────────────────────────────────┐
// │           SSS Transfer Hook — Blacklist Enforcement              │
// │                                                                  │
// │  This is a SEPARATE program from sss-token. It implements the   │
// │  Transfer Hook Interface so Token-2022 invokes it on every      │
// │  transfer_checked call for SSS-2 mints.                         │
// │                                                                  │
// │  What it does:                                                   │
// │  1. Receives source/destination token account info               │
// │  2. Derives BlacklistEntry PDAs for both owners                  │
// │  3. If either PDA exists → reject the transfer                  │
// │  4. If neither exists → allow the transfer                      │
// │                                                                  │
// │  This program will be fully implemented in Phase 1.5.           │
// └──────────────────────────────────────────────────────────────────┘

use anchor_lang::prelude::*;

declare_id!("SSSHookXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod sss_transfer_hook {
    use super::*;

    /// Initialize the ExtraAccountMetaList for this mint.
    /// Called once after mint creation to tell Token-2022 which additional
    /// accounts the hook needs (the blacklist PDAs for sender and receiver).
    ///
    /// Will be implemented in Phase 1.5.
    pub fn initialize_extra_account_meta_list(
        _ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // TODO: Phase 1.5
        Ok(())
    }

    /// The actual transfer hook logic.
    /// Anchor's fallback instruction routes here when Token-2022 CPIs
    /// with the Transfer Hook Execute discriminator.
    ///
    /// Will be implemented in Phase 1.5.
    pub fn transfer_hook(
        _ctx: Context<TransferHook>,
        _amount: u64,
    ) -> Result<()> {
        // TODO: Phase 1.5 — check blacklist PDAs
        Ok(())
    }

    /// Fallback instruction handler.
    ///
    /// WHY THIS EXISTS:
    /// Token-2022 uses native Solana instruction discriminators for the
    /// Transfer Hook Interface (not Anchor's 8-byte discriminator).
    /// Anchor doesn't natively generate these discriminators, so we need
    /// a fallback function that manually matches the incoming discriminator
    /// against the Transfer Hook Interface's `Execute` instruction.
    ///
    /// When Token-2022 calls our program during a transfer, it sends:
    ///   discriminator = spl_transfer_hook_interface::instruction::ExecuteInstruction
    ///
    /// Anchor doesn't recognize this, so it falls through to `fallback`.
    /// We check the discriminator manually and call our transfer_hook handler.
    ///
    /// NOTE: There's an upcoming Anchor feature that will remove the need
    /// for this, but as of Anchor 0.31.x it's still required.
    pub fn fallback<'info>(
        _program_id: &Pubkey,
        _accounts: &'info [AccountInfo<'info>],
        _data: &[u8],
    ) -> Result<()> {
        // TODO: Phase 1.5 — match Execute discriminator and dispatch
        Ok(())
    }
}

// Placeholder account structs — will be fully defined in Phase 1.5.

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList {}

#[derive(Accounts)]
pub struct TransferHook {}
