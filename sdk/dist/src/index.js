"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleType = exports.TOKEN_2022_PROGRAM_ID = exports.SSS_TRANSFER_HOOK_PROGRAM_ID = exports.SSS_TOKEN_PROGRAM_ID = exports.resolveTransferHookAccounts = exports.findAta = exports.findExtraAccountMetaListPda = exports.findBlacklistEntryPda = exports.findRoleManagerPda = exports.findStablecoinConfigPda = exports.getPresetLabel = exports.resolveFeatures = exports.Presets = exports.ComplianceModule = exports.SolanaStablecoin = void 0;
// ── Primary class ────────────────────────────────────────────────
var stablecoin_1 = require("./stablecoin");
Object.defineProperty(exports, "SolanaStablecoin", { enumerable: true, get: function () { return stablecoin_1.SolanaStablecoin; } });
// ── Compliance module (SSS-2) ────────────────────────────────────
var compliance_1 = require("./compliance");
Object.defineProperty(exports, "ComplianceModule", { enumerable: true, get: function () { return compliance_1.ComplianceModule; } });
// ── Presets & configuration ──────────────────────────────────────
var presets_1 = require("./presets");
Object.defineProperty(exports, "Presets", { enumerable: true, get: function () { return presets_1.Presets; } });
Object.defineProperty(exports, "resolveFeatures", { enumerable: true, get: function () { return presets_1.resolveFeatures; } });
Object.defineProperty(exports, "getPresetLabel", { enumerable: true, get: function () { return presets_1.getPresetLabel; } });
// ── PDA derivation utilities ─────────────────────────────────────
var pda_1 = require("./pda");
Object.defineProperty(exports, "findStablecoinConfigPda", { enumerable: true, get: function () { return pda_1.findStablecoinConfigPda; } });
Object.defineProperty(exports, "findRoleManagerPda", { enumerable: true, get: function () { return pda_1.findRoleManagerPda; } });
Object.defineProperty(exports, "findBlacklistEntryPda", { enumerable: true, get: function () { return pda_1.findBlacklistEntryPda; } });
Object.defineProperty(exports, "findExtraAccountMetaListPda", { enumerable: true, get: function () { return pda_1.findExtraAccountMetaListPda; } });
Object.defineProperty(exports, "findAta", { enumerable: true, get: function () { return pda_1.findAta; } });
Object.defineProperty(exports, "resolveTransferHookAccounts", { enumerable: true, get: function () { return pda_1.resolveTransferHookAccounts; } });
Object.defineProperty(exports, "SSS_TOKEN_PROGRAM_ID", { enumerable: true, get: function () { return pda_1.SSS_TOKEN_PROGRAM_ID; } });
Object.defineProperty(exports, "SSS_TRANSFER_HOOK_PROGRAM_ID", { enumerable: true, get: function () { return pda_1.SSS_TRANSFER_HOOK_PROGRAM_ID; } });
Object.defineProperty(exports, "TOKEN_2022_PROGRAM_ID", { enumerable: true, get: function () { return pda_1.TOKEN_2022_PROGRAM_ID; } });
// ── All types ────────────────────────────────────────────────────
var types_1 = require("./types");
Object.defineProperty(exports, "RoleType", { enumerable: true, get: function () { return types_1.RoleType; } });
//# sourceMappingURL=index.js.map