// programs/sss-token/src/instructions/init_hook_accounts.rs
//
// After `initialize` creates the SSS-2 mint, this instruction must be
// called to set up the transfer hook's ExtraAccountMetaList. Without
// this, the first token transfer will fail because Token-2022 can't
// resolve the extra accounts needed by the hook.
//
// WHY SEPARATE FROM INITIALIZE:
// The ExtraAccountMetaList is owned by the sss-transfer-hook program
// (a different program). We need a CPI to that program. We keep it
// separate to avoid making `initialize` depend on the hook program
// being deployed (SSS-1 doesn't need it at all).
//
// CALL ORDER:
// 1. sss_token::initialize (creates mint + config + roles)
// 2. sss_token::init_hook_accounts (creates extra meta list on hook program)
// 3. Ready for transfers
//
// The TypeScript SDK's `SolanaStablecoin.create()` handles both calls
// in a single transaction when preset is SSS-2.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::constants::*;
use crate::errors::SSSError;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct InitHookAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, stablecoin_config.mint.as_ref()],
        bump = stablecoin_config.bump,
        constraint = stablecoin_config.enable_transfer_hook @ SSSError::TransferHookNotEnabled,
    )]
    pub stablecoin_config: Account<'info, StablecoinConfig>,

    /// The mint with transfer hook extension.
    /// CHECK: Verified via has_one on config.
    pub mint: AccountInfo<'info>,

    /// The ExtraAccountMetaList PDA to be created.
    /// Seeds: ["extra-account-metas", mint] on the hook program.
    /// CHECK: The hook program validates this.
    #[account(mut)]
    pub extra_account_meta_list: AccountInfo<'info>,

    /// The sss-transfer-hook program.
    /// CHECK: Must match the expected hook program ID.
    #[account(
        constraint = hook_program.key() == TRANSFER_HOOK_PROGRAM_ID
            @ SSSError::TransferHookNotEnabled,
    )]
    pub hook_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitHookAccounts>) -> Result<()> {
    // The hook program's `initialize_extra_account_meta_list` instruction
    // creates the PDA and populates it with the account resolution rules.
    //
    // We invoke it from here so the SDK can do everything in one flow.

    let ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ctx.accounts.hook_program.key(),
        accounts: vec![
            anchor_lang::solana_program::instruction::AccountMeta::new(
                ctx.accounts.payer.key(),
                true,
            ),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                ctx.accounts.mint.key(),
                false,
            ),
            anchor_lang::solana_program::instruction::AccountMeta::new(
                ctx.accounts.extra_account_meta_list.key(),
                false,
            ),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                ctx.accounts.system_program.key(),
                false,
            ),
        ],
        // The discriminator for the hook program's initialize_extra_account_meta_list.
        // Anchor's discriminator = first 8 bytes of SHA256("global:initialize_extra_account_meta_list")
        // We compute this manually to avoid a cross-crate dependency.
        data: {
            use anchor_lang::solana_program::hash::hash;
            let disc = hash(b"global:initialize_extra_account_meta_list");
            disc.to_bytes()[..8].to_vec()
        },
    };

    invoke_signed(
        &ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.extra_account_meta_list.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[],
    )?;

    msg!("Transfer hook ExtraAccountMetaList initialized");
    Ok(())
}
