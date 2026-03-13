// sdk/src/pda.ts
//
// PDA derivation utilities. Every seed must EXACTLY match the on-chain
// constants in programs/sss-token/src/constants.rs.
//
// If these ever diverge, transactions will fail with "seeds constraint violated".

import { Connection, PublicKey } from "@solana/web3.js";
import {
  addExtraAccountMetasForExecute,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

function envValue(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name];
}

// ============================================================================
// PROGRAM IDS — Replace after deployment
// ============================================================================

/** The sss-token main program ID. Replace with actual deployed address. */
export const SSS_TOKEN_PROGRAM_ID = new PublicKey(
  envValue("SSS_TOKEN_PROGRAM_ID") ?? "A5nx6XK7PvhxhyzXNtY5ARGCC1WLymkuLKeBYNg78U4q",
);

/** The sss-transfer-hook program ID. Replace with actual deployed address. */
export const SSS_TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  envValue("SSS_TRANSFER_HOOK_PROGRAM_ID") ??
    "8RU51UBAQKVBRiAJCEsEUbq331ruTp7KF61ranWott1j",
);

/** Token-2022 program ID. */
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

// ============================================================================
// SEED CONSTANTS — must match on-chain constants.rs
// ============================================================================

const STABLECOIN_SEED = Buffer.from("stablecoin");
const ROLES_SEED = Buffer.from("roles");
const BLACKLIST_SEED = Buffer.from("blacklist");
const EXTRA_ACCOUNT_METAS_SEED = Buffer.from("extra-account-metas");

// ============================================================================
// PDA DERIVATION FUNCTIONS
// ============================================================================

/**
 * Derive the StablecoinConfig PDA.
 *
 * Seeds: ["stablecoin", mint_pubkey]
 * Program: sss_token
 *
 * @param mint - The Token-2022 mint address
 * @returns [pda, bump]
 */
export function findStablecoinConfigPda(
  mint: PublicKey,
  programId: PublicKey = SSS_TOKEN_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STABLECOIN_SEED, mint.toBuffer()],
    programId,
  );
}

/**
 * Derive the RoleManager PDA.
 *
 * Seeds: ["roles", stablecoin_config_pubkey]
 * Program: sss_token
 *
 * @param configPda - The StablecoinConfig PDA address
 * @returns [pda, bump]
 */
export function findRoleManagerPda(
  configPda: PublicKey,
  programId: PublicKey = SSS_TOKEN_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ROLES_SEED, configPda.toBuffer()],
    programId,
  );
}

/**
 * Derive a BlacklistEntry PDA for a specific wallet owner.
 *
 * Seeds: ["blacklist", stablecoin_config_pubkey, wallet_owner_pubkey]
 * Program: sss_token
 *
 * The PDA's existence = the wallet is blacklisted.
 * If findProgramAddress succeeds but the account doesn't exist on-chain,
 * the wallet is NOT blacklisted.
 *
 * @param configPda - The StablecoinConfig PDA address
 * @param walletOwner - The wallet address to check (NOT a token account)
 * @returns [pda, bump]
 */
export function findBlacklistEntryPda(
  configPda: PublicKey,
  walletOwner: PublicKey,
  programId: PublicKey = SSS_TOKEN_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, configPda.toBuffer(), walletOwner.toBuffer()],
    programId,
  );
}

/**
 * Derive the ExtraAccountMetaList PDA for the transfer hook.
 *
 * Seeds: ["extra-account-metas", mint_pubkey]
 * Program: sss_transfer_hook
 *
 * This PDA is created by `init_hook_accounts` and read by Token-2022
 * on every transfer to resolve additional accounts for the hook.
 *
 * @param mint - The Token-2022 mint address
 * @returns [pda, bump]
 */
export function findExtraAccountMetaListPda(
  mint: PublicKey,
  hookProgramId: PublicKey = SSS_TRANSFER_HOOK_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_SEED, mint.toBuffer()],
    hookProgramId,
  );
}

/**
 * Find the Associated Token Account for a wallet and mint on Token-2022.
 *
 * Wrapper around @solana/spl-token's getAssociatedTokenAddressSync
 * that defaults to the Token-2022 program.
 */
export function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
  // Use spl-token's ATA derivation
  const { getAssociatedTokenAddressSync } = require("@solana/spl-token");
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    true, // allowOwnerOffCurve (allow PDA owners)
    TOKEN_2022_PROGRAM_ID,
  );
}

// ============================================================================
// TRANSFER HOOK ACCOUNT RESOLUTION
// ============================================================================

/**
 * Resolve ALL extra accounts needed by Token-2022 when processing a
 * transfer_checked on an SSS-2 mint with a TransferHook extension.
 *
 * Token-2022's transfer_checked processor scans the instruction's
 * account list (after the base 4: source, mint, dest, authority)
 * to find the ExtraAccountMetaList, the hook program, and all
 * resolved extra metas. If any are missing → error 0xa261c2c0.
 *
 * This function returns the accounts in the exact order that
 * Token-2022 expects (matching the ExtraAccountMetaList layout
 * defined in sss-transfer-hook's initialize_extra_account_meta_list).
 *
 * @param connection - Solana connection (to fetch token account owners)
 * @param mint - The Token-2022 mint
 * @param sourceTokenAccount - Source token account pubkey
 * @param destTokenAccount - Destination token account pubkey
 * @param configPda - StablecoinConfig PDA
 * @returns Array of AccountMeta objects to pass as remainingAccounts
 */
export async function resolveTransferHookAccounts(
  connection: Connection,
  mint: PublicKey,
  sourceTokenAccount: PublicKey,
  destTokenAccount: PublicKey,
  configPda: PublicKey,
): Promise<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]> {
  // Build a probe transfer instruction and ask SPL Token's official resolver
  // to add hook accounts from the on-chain ExtraAccountMetaList. This avoids
  // hardcoded assumptions when metas evolve across deployments.
  const probeIx = createTransferCheckedInstruction(
    sourceTokenAccount,
    mint,
    destTokenAccount,
    configPda, // permanent delegate authority for seize path
    0, // amount is irrelevant for our current seed set
    0, // decimals are irrelevant for Execute account resolution
    [],
    TOKEN_2022_PROGRAM_ID,
  );

  await addExtraAccountMetasForExecute(
    connection,
    probeIx,
    SSS_TRANSFER_HOOK_PROGRAM_ID,
    sourceTokenAccount,
    mint,
    destTokenAccount,
    configPda,
    0n,
    "confirmed",
  );

  // After base 4 accounts, SPL appends:
  //   resolved extra metas..., hook program, extra-account-meta-list PDA
  // We normalize to the order expected by seize():
  //   [extra-meta-list, hook-program, resolved metas...]
  const appended = probeIx.keys.slice(4);
  if (appended.length < 2) {
    throw new Error("Transfer hook accounts were not resolved");
  }

  const hookProgramMeta = appended[appended.length - 2];
  const extraMetaList = appended[appended.length - 1];
  const resolvedMetas = appended.slice(0, appended.length - 2);

  return [extraMetaList, hookProgramMeta, ...resolvedMetas].map((k) => ({
    pubkey: k.pubkey,
    isSigner: k.isSigner,
    isWritable: k.isWritable,
  }));
}
