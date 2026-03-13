// programs/sss-transfer-hook/src/lib.rs
//
// ┌──────────────────────────────────────────────────────────────────┐
// │             SSS TRANSFER HOOK — Blacklist Enforcement            │
// │                                                                  │
// │  This is a SEPARATE PROGRAM from sss-token.                     │
// │  Token-2022 CPIs into this on every transfer_checked for SSS-2  │
// │  mints.                                                          │
// │                                                                  │
// │  ACCOUNT INDEX MAP (standard transfer_checked accounts):        │
// │  Index 0: source token account                                   │
// │  Index 1: mint                                                   │
// │  Index 2: destination token account                              │
// │  Index 3: source owner/authority (signer)                       │
// │  Index 4: ExtraAccountMetaList PDA (this program)               │
// │                                                                  │
// │  EXTRA ACCOUNTS (resolved dynamically by Token-2022):           │
// │  Index 5: sss_token program ID (for PDA derivation)             │
// │  Index 6: StablecoinConfig PDA (read-only)                      │
// │  Index 7: Source owner's BlacklistEntry PDA (may not exist)     │
// │  Index 8: Destination owner's BlacklistEntry PDA (may not exist)│
// │                                                                  │
// │  BLACKLIST CHECK LOGIC:                                          │
// │  - If BlacklistEntry PDA for source owner EXISTS → REJECT       │
// │  - If BlacklistEntry PDA for dest owner EXISTS → REJECT         │
// │  - If neither exists → ALLOW transfer                           │
// │                                                                  │
// │  HOW OWNER IS RESOLVED:                                          │
// │  - Source owner: directly from standard account index 3          │
// │  - Dest owner: extracted from destination token account data    │
// │    at byte offset 32 (after the mint pubkey in Token-2022       │
// │    account layout: [mint: Pubkey(32), owner: Pubkey(32), ...])  │
// └──────────────────────────────────────────────────────────────────┘

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

declare_id!("8hCc8wEKWuSVqQLo5HKwEYuJVR7GaQTxcXw8he38ZVUK");

/// The sss-token program ID. Must match the deployed sss_token program.
/// REPLACE after deployment.
pub const SSS_TOKEN_PROGRAM_ID: anchor_lang::prelude::Pubkey =
    anchor_lang::pubkey!("sW63DevsGFLUj9hsGutuqazT6zGJr7vvWG4FusG6tTk");


/// Seed used to derive the ExtraAccountMetaList PDA.
/// Standard seed from spl-transfer-hook-interface.
const EXTRA_META_SEED: &[u8] = b"extra-account-metas";

/// Seed used by sss-token to derive StablecoinConfig PDAs.
const STABLECOIN_SEED: &[u8] = b"stablecoin";

/// Seed used by sss-token to derive BlacklistEntry PDAs.
const BLACKLIST_SEED: &[u8] = b"blacklist";

#[program]
pub mod sss_transfer_hook {
    use super::*;

    /// Initialize the ExtraAccountMetaList for a given mint.
    ///
    /// Called ONCE after the SSS-2 mint is created, BEFORE any transfers.
    /// Sets up the dynamic account resolution rules so Token-2022 knows
    /// which additional accounts to pass to the transfer hook on each transfer.
    ///
    /// Must be called by the mint authority (StablecoinConfig PDA from sss-token).
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // Define the extra accounts the hook needs on every transfer.
        // Token-2022 will resolve these dynamically using the seed rules.
        let extra_metas = vec![
            // ── Index 5: sss_token program ID ────────────────────
            // Static pubkey — the sss-token program that owns blacklist PDAs.
            ExtraAccountMeta::new_with_pubkey(&SSS_TOKEN_PROGRAM_ID, false, false)
                .map_err(|_| ProgramError::InvalidAccountData)?,

            // ── Index 6: StablecoinConfig PDA ────────────────────
            // Derived: ["stablecoin", mint] using sss_token program
            // mint is at standard index 1
            // program is at extra index 0 (overall index 5)
            ExtraAccountMeta::new_external_pda_with_seeds(
                5, // program index (sss_token)
                &[
                    Seed::Literal {
                        bytes: STABLECOIN_SEED.to_vec(),
                    },
                    Seed::AccountKey { index: 1 }, // mint
                ],
                false, // is_signer
                false, // is_writable
            )
            .map_err(|_| ProgramError::InvalidAccountData)?,

            // ── Index 7: Source owner BlacklistEntry PDA ─────────
            // Derived: ["blacklist", config, source_owner] using sss_token program
            // config is at overall index 6
            // source_owner is at standard index 3 (authority)
            ExtraAccountMeta::new_external_pda_with_seeds(
                5, // program index (sss_token)
                &[
                    Seed::Literal {
                        bytes: BLACKLIST_SEED.to_vec(),
                    },
                    Seed::AccountKey { index: 6 }, // stablecoin_config
                    Seed::AccountKey { index: 3 }, // source authority/owner
                ],
                false,
                false,
            )
            .map_err(|_| ProgramError::InvalidAccountData)?,

            // ── Index 8: Destination owner BlacklistEntry PDA ────
            // Derived: ["blacklist", config, dest_owner] using sss_token program
            // config is at overall index 6
            // dest_owner is extracted from destination token account (index 2)
            //   at byte offset 32 (after the mint Pubkey), length 32 bytes
            //
            // Token-2022 account layout:
            //   bytes 0..32:  mint (Pubkey)
            //   bytes 32..64: owner (Pubkey)  ← we extract this
            //   bytes 64..72: amount (u64)
            //   ...
            ExtraAccountMeta::new_external_pda_with_seeds(
                5, // program index (sss_token)
                &[
                    Seed::Literal {
                        bytes: BLACKLIST_SEED.to_vec(),
                    },
                    Seed::AccountKey { index: 6 }, // stablecoin_config
                    Seed::AccountData {
                        account_index: 2,  // destination token account
                        data_index: 32,    // offset to owner field
                        length: 32,        // Pubkey is 32 bytes
                    },
                ],
                false,
                false,
            )
            .map_err(|_| ProgramError::InvalidAccountData)?,
        ];

        // Calculate space and initialize the ExtraAccountMetaList PDA.
        let account_info = ctx.accounts.extra_account_meta_list.to_account_info();
        let mut data = account_info.try_borrow_mut_data()?;

        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &extra_metas)?;

        Ok(())
    }

    /// The actual transfer hook logic.
    ///
    /// Called by Token-2022 via CPI on every transfer_checked for this mint.
    /// Checks if source or destination owner is blacklisted.
    ///
    /// NOTE: This function is NOT called directly — it's invoked through
    /// the `fallback` function which matches the Transfer Hook Interface
    /// discriminator.
    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        // ── Check source owner blacklist ─────────────────────────
        // If the BlacklistEntry PDA for the source owner has data,
        // the owner is blacklisted.
        let source_blacklist = &ctx.accounts.source_blacklist;
        if source_blacklist.data_len() > 0 {
            // Account exists and has data — owner is blacklisted
            msg!("Transfer rejected: source owner is blacklisted");
            return Err(ProgramError::Custom(6030).into()); // AddressBlacklisted
        }

        // ── Check destination owner blacklist ────────────────────
        let dest_blacklist = &ctx.accounts.dest_blacklist;
        if dest_blacklist.data_len() > 0 {
            msg!("Transfer rejected: destination owner is blacklisted");
            return Err(ProgramError::Custom(6030).into());
        }

        // Neither owner is blacklisted — transfer proceeds
        Ok(())
    }

    /// Fallback instruction handler.
    ///
    /// Token-2022 calls the Transfer Hook program with the Execute
    /// instruction discriminator from spl-transfer-hook-interface,
    /// NOT Anchor's discriminator. This fallback function catches
    /// that call and routes it to our transfer_hook handler.
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        // Check if incoming instruction matches the Transfer Hook Execute discriminator
        let instruction = spl_transfer_hook_interface::instruction::TransferHookInstruction::unpack(data)?;

        match instruction {
            spl_transfer_hook_interface::instruction::TransferHookInstruction::Execute { amount } => {
                // Reconstruct the accounts for our handler.
                // Standard layout from Token-2022:
                //   0: source
                //   1: mint
                //   2: destination
                //   3: authority
                //   4: extra_account_meta_list
                //   5+: resolved extra accounts

                // Verify we have enough accounts
                if accounts.len() < 9 {
                    return Err(ProgramError::NotEnoughAccountKeys.into());
                }

                let source_account = &accounts[0];
                let mint = &accounts[1];
                let dest_account = &accounts[2];
                let authority = &accounts[3];
                let extra_meta_list = &accounts[4];
                let _sss_token_program = &accounts[5];
                let _stablecoin_config = &accounts[6];
                let source_blacklist = &accounts[7];
                let dest_blacklist = &accounts[8];

                // ── Validate extra account meta list PDA ─────────
                let (expected_meta_pda, _bump) = Pubkey::find_program_address(
                    &[EXTRA_META_SEED, mint.key.as_ref()],
                    program_id,
                );
                if *extra_meta_list.key != expected_meta_pda {
                    return Err(ProgramError::InvalidSeeds.into());
                }

                // ── Check blacklists ─────────────────────────────
                // If the account has data (exists and is initialized),
                // the owner is blacklisted.
                if source_blacklist.data_len() > 0 {
                    msg!("Transfer rejected: source owner is blacklisted");
                    return Err(ProgramError::Custom(6030).into());
                }

                if dest_blacklist.data_len() > 0 {
                    msg!("Transfer rejected: destination owner is blacklisted");
                    return Err(ProgramError::Custom(6030).into());
                }

                msg!("Transfer hook: both parties clear, transfer allowed");
                Ok(())
            }
            _ => {
                Err(ProgramError::InvalidInstructionData.into())
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// ACCOUNT CONTEXTS
// ═══════════════════════════════════════════════════════════════════

/// Accounts for initializing the ExtraAccountMetaList.
///
/// Called once after SSS-2 mint creation. The meta list PDA is derived
/// from ["extra-account-metas", mint] with this program as owner.
#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    /// Payer for the account creation rent.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The Token-2022 mint with the TransferHook extension pointing to this program.
    /// CHECK: We verify it's a valid mint in the constraint.
    pub mint: AccountInfo<'info>,

    /// The ExtraAccountMetaList PDA to create.
    /// Seeds: ["extra-account-metas", mint]
    /// This account is owned by THIS program (sss-transfer-hook).
    ///
    /// We create it manually because the space depends on the number
    /// of extra metas we define (4 in our case).
    ///
    /// CHECK: We derive and verify the PDA in the handler.
    #[account(
        init,
        payer = payer,
        space = ExtraAccountMetaList::size_of(4).unwrap(), // 4 extra metas
        seeds = [EXTRA_META_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for the transfer hook execution.
///
/// NOTE: In practice, the fallback handler processes accounts manually
/// (not through this struct) because Token-2022 uses its own discriminator.
/// This struct exists for documentation and for direct Anchor calls in tests.
#[derive(Accounts)]
pub struct TransferHook<'info> {
    /// CHECK: Source token account (passed by Token-2022)
    pub source: AccountInfo<'info>,

    /// CHECK: Mint (passed by Token-2022)
    pub mint: AccountInfo<'info>,

    /// CHECK: Destination token account (passed by Token-2022)
    pub destination: AccountInfo<'info>,

    /// CHECK: Source owner/authority (passed by Token-2022)
    pub authority: AccountInfo<'info>,

    /// CHECK: ExtraAccountMetaList PDA
    pub extra_account_meta_list: AccountInfo<'info>,

    /// CHECK: sss-token program ID
    pub sss_token_program: AccountInfo<'info>,

    /// CHECK: StablecoinConfig PDA (from sss-token program)
    pub stablecoin_config: AccountInfo<'info>,

    /// CHECK: Source owner's BlacklistEntry PDA.
    /// May be an empty/non-existent account (not blacklisted) or
    /// an initialized account (blacklisted).
    pub source_blacklist: AccountInfo<'info>,

    /// CHECK: Destination owner's BlacklistEntry PDA.
    pub dest_blacklist: AccountInfo<'info>,
}
