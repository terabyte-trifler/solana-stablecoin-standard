import { PublicKey } from "@solana/web3.js";
/** The sss-token main program ID. Replace with actual deployed address. */
export declare const SSS_TOKEN_PROGRAM_ID: PublicKey;
/** The sss-transfer-hook program ID. Replace with actual deployed address. */
export declare const SSS_TRANSFER_HOOK_PROGRAM_ID: PublicKey;
/** Token-2022 program ID. */
export declare const TOKEN_2022_PROGRAM_ID: PublicKey;
/**
 * Derive the StablecoinConfig PDA.
 *
 * Seeds: ["stablecoin", mint_pubkey]
 * Program: sss_token
 *
 * @param mint - The Token-2022 mint address
 * @returns [pda, bump]
 */
export declare function findStablecoinConfigPda(mint: PublicKey, programId?: PublicKey): [PublicKey, number];
/**
 * Derive the RoleManager PDA.
 *
 * Seeds: ["roles", stablecoin_config_pubkey]
 * Program: sss_token
 *
 * @param configPda - The StablecoinConfig PDA address
 * @returns [pda, bump]
 */
export declare function findRoleManagerPda(configPda: PublicKey, programId?: PublicKey): [PublicKey, number];
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
export declare function findBlacklistEntryPda(configPda: PublicKey, walletOwner: PublicKey, programId?: PublicKey): [PublicKey, number];
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
export declare function findExtraAccountMetaListPda(mint: PublicKey, hookProgramId?: PublicKey): [PublicKey, number];
/**
 * Find the Associated Token Account for a wallet and mint on Token-2022.
 *
 * Wrapper around @solana/spl-token's getAssociatedTokenAddressSync
 * that defaults to the Token-2022 program.
 */
export declare function findAta(mint: PublicKey, owner: PublicKey): PublicKey;
//# sourceMappingURL=pda.d.ts.map