// tests/helpers/accounts.ts
//
// Account creation and query helpers used across test suites.

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  Account as TokenAccount,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  TestContext,
  findBlacklistPda,
  findExtraMetaListPda,
} from "./setup";

/**
 * Create an ATA for an owner if it doesn't exist.
 * Returns the ATA address.
 */
export async function ensureAta(
  ctx: TestContext,
  owner: PublicKey,
  payer?: Keypair
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(
    ctx.mintKeypair.publicKey,
    owner,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const info = await ctx.connection.getAccountInfo(ata);
  if (!info) {
    const ix = createAssociatedTokenAccountInstruction(
      (payer ?? ctx.authority).publicKey,
      ata,
      owner,
      ctx.mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new (require("@solana/web3.js").Transaction)().add(ix);
    await ctx.connection.sendTransaction(tx, [payer ?? ctx.authority]);
  }

  return ata;
}

/**
 * Fetch a Token-2022 account with full extension data.
 */
export async function fetchTokenAccount(
  ctx: TestContext,
  address: PublicKey
): Promise<TokenAccount> {
  return getAccount(ctx.connection, address, "confirmed", TOKEN_2022_PROGRAM_ID);
}

/**
 * Check if a token account is frozen.
 */
export async function isAccountFrozen(
  ctx: TestContext,
  tokenAccount: PublicKey
): Promise<boolean> {
  const account = await fetchTokenAccount(ctx, tokenAccount);
  return account.isFrozen;
}

/**
 * Build the remaining accounts array needed for seize on SSS-2 mints.
 * Token-2022 requires these for any transfer_checked on hook-enabled mints.
 *
 * @param ctx - Test context
 * @param sourceOwner - Owner of the source token account
 * @param destOwner - Owner of the destination token account
 * @returns Array of AccountMeta objects for .remainingAccounts()
 */
export function buildHookRemainingAccounts(
  ctx: TestContext,
  sourceOwner: PublicKey,
  destOwner: PublicKey
): { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] {
  const [extraMetaList] = findExtraMetaListPda(
    ctx.mintKeypair.publicKey,
    ctx.hookProgram.programId
  );
  const [srcBlacklist] = findBlacklistPda(
    ctx.configPda,
    sourceOwner,
    ctx.program.programId
  );
  const [dstBlacklist] = findBlacklistPda(
    ctx.configPda,
    destOwner,
    ctx.program.programId
  );

  return [
    { pubkey: extraMetaList, isSigner: false, isWritable: false },
    { pubkey: ctx.hookProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ctx.program.programId, isSigner: false, isWritable: false },
    { pubkey: ctx.configPda, isSigner: false, isWritable: false },
    { pubkey: srcBlacklist, isSigner: false, isWritable: false },
    { pubkey: dstBlacklist, isSigner: false, isWritable: false },
  ];
}

/**
 * Airdrop SOL to a keypair and wait for confirmation.
 */
export async function airdrop(
  connection: Connection,
  to: PublicKey,
  amount: number = 5 * LAMPORTS_PER_SOL
): Promise<void> {
  const sig = await connection.requestAirdrop(to, amount);
  await connection.confirmTransaction(sig);
}

/**
 * Check if a blacklist PDA exists on-chain.
 */
export async function isBlacklisted(
  ctx: TestContext,
  walletOwner: PublicKey
): Promise<boolean> {
  const [pda] = findBlacklistPda(
    ctx.configPda,
    walletOwner,
    ctx.program.programId
  );
  const info = await ctx.connection.getAccountInfo(pda);
  return info !== null && info.data.length > 0;
}
