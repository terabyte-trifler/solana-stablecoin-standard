// sdk/src/index.ts
//
// Public API entry point for @stbr/sss-token
//
// Usage:
//   import {
//     SolanaStablecoin,
//     Presets,
//     ComplianceModule,
//     RoleType,
//     findStablecoinConfigPda,
//   } from "@stbr/sss-token";

// ── Primary class ────────────────────────────────────────────────
export { SolanaStablecoin } from "./stablecoin";

// ── Compliance module (SSS-2) ────────────────────────────────────
export { ComplianceModule } from "./compliance";

// ── Presets & configuration ──────────────────────────────────────
export { Presets, resolveFeatures, getPresetLabel } from "./presets";

// ── PDA derivation utilities ─────────────────────────────────────
export {
  findStablecoinConfigPda,
  findRoleManagerPda,
  findBlacklistEntryPda,
  findExtraAccountMetaListPda,
  findAta,
  resolveTransferHookAccounts,
  SSS_TOKEN_PROGRAM_ID,
  SSS_TRANSFER_HOOK_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "./pda";

// ── All types ────────────────────────────────────────────────────
export {
  StablecoinFeatures,
  StablecoinCreateOptions,
  StablecoinConfigAccount,
  RoleManagerAccount,
  MinterEntry,
  BlacklistEntryAccount,
  MintParams,
  BurnParams,
  SeizeParams,
  RoleType,
  HolderInfo,
  AuditLogFilters,
  AuditEvent,
} from "./types";
