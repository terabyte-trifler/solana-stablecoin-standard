"use strict";
// sdk/src/pda.ts
//
// PDA derivation utilities. Every seed must EXACTLY match the on-chain
// constants in programs/sss-token/src/constants.rs.
//
// If these ever diverge, transactions will fail with "seeds constraint violated".
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKEN_2022_PROGRAM_ID = exports.SSS_TRANSFER_HOOK_PROGRAM_ID = exports.SSS_TOKEN_PROGRAM_ID = void 0;
exports.findStablecoinConfigPda = findStablecoinConfigPda;
exports.findRoleManagerPda = findRoleManagerPda;
exports.findBlacklistEntryPda = findBlacklistEntryPda;
exports.findExtraAccountMetaListPda = findExtraAccountMetaListPda;
exports.findAta = findAta;
const web3_js_1 = require("@solana/web3.js");
// ============================================================================
// PROGRAM IDS — Replace after deployment
// ============================================================================
/** The sss-token main program ID. Replace with actual deployed address. */
exports.SSS_TOKEN_PROGRAM_ID = new web3_js_1.PublicKey("sW63DevsGFLUj9hsGutuqazT6zGJr7vvWG4FusG6tTk");
/** The sss-transfer-hook program ID. Replace with actual deployed address. */
exports.SSS_TRANSFER_HOOK_PROGRAM_ID = new web3_js_1.PublicKey("8hCc8wEKWuSVqQLo5HKwEYuJVR7GaQTxcXw8he38ZVUK");
/** Token-2022 program ID. */
exports.TOKEN_2022_PROGRAM_ID = new web3_js_1.PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
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
function findStablecoinConfigPda(mint, programId = exports.SSS_TOKEN_PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([STABLECOIN_SEED, mint.toBuffer()], programId);
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
function findRoleManagerPda(configPda, programId = exports.SSS_TOKEN_PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([ROLES_SEED, configPda.toBuffer()], programId);
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
function findBlacklistEntryPda(configPda, walletOwner, programId = exports.SSS_TOKEN_PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([BLACKLIST_SEED, configPda.toBuffer(), walletOwner.toBuffer()], programId);
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
function findExtraAccountMetaListPda(mint, hookProgramId = exports.SSS_TRANSFER_HOOK_PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([EXTRA_ACCOUNT_METAS_SEED, mint.toBuffer()], hookProgramId);
}
/**
 * Find the Associated Token Account for a wallet and mint on Token-2022.
 *
 * Wrapper around @solana/spl-token's getAssociatedTokenAddressSync
 * that defaults to the Token-2022 program.
 */
function findAta(mint, owner) {
    // Use spl-token's ATA derivation
    const { getAssociatedTokenAddressSync } = require("@solana/spl-token");
    return getAssociatedTokenAddressSync(mint, owner, true, // allowOwnerOffCurve (allow PDA owners)
    exports.TOKEN_2022_PROGRAM_ID);
}
//# sourceMappingURL=pda.js.map