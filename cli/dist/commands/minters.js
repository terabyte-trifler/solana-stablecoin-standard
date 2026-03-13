"use strict";
// cli/src/commands/minters.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintersListCommand = mintersListCommand;
exports.mintersAddCommand = mintersAddCommand;
exports.mintersRemoveCommand = mintersRemoveCommand;
const web3_js_1 = require("@solana/web3.js");
const bn_js_1 = __importDefault(require("bn.js"));
const sss_token_1 = require("@stbr/sss-token");
const config_1 = require("../config");
const display = __importStar(require("../display"));
async function loadStable(opts) {
    const connection = (0, config_1.getConnection)(opts.parent?.opts?.url || opts.url);
    const configPda = (0, config_1.resolveConfigPda)(opts.parent?.opts?.config || opts.config);
    const wallet = (0, config_1.loadKeypair)(opts.parent?.opts?.keypair || opts.keypair);
    return sss_token_1.SolanaStablecoin.load(connection, configPda, wallet);
}
// ═══════════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════════
async function mintersListCommand(opts) {
    try {
        const stable = await loadStable(opts);
        const config = await stable.getConfig();
        const roles = await stable.getRoles();
        if (roles.minters.length === 0) {
            display.info("No minters registered");
            return;
        }
        display.header(`Minters (${roles.minters.length})`);
        display.table(["Address", "Quota/Epoch", "Minted", "Remaining", "Epoch"], roles.minters.map((m) => {
            const quotaStr = m.quota.isZero()
                ? "unlimited"
                : display.fmtAmount(m.quota, config.decimals);
            const mintedStr = display.fmtAmount(m.minted, config.decimals);
            const remaining = m.quota.isZero()
                ? "∞"
                : display.fmtAmount(m.quota.sub(bn_js_1.default.min(m.minted, m.quota)), config.decimals);
            return [
                display.shortKey(m.address),
                quotaStr,
                mintedStr,
                remaining,
                m.lastResetEpoch.toString(),
            ];
        }));
        console.log();
    }
    catch (err) {
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// ADD
// ═══════════════════════════════════════════════════════════════
async function mintersAddCommand(address, opts) {
    const spin = display.spinner("Adding minter");
    try {
        const stable = await loadStable(opts);
        const config = await stable.getConfig();
        const authority = (0, config_1.loadKeypair)(opts.parent?.opts?.keypair || opts.keypair);
        const quota = opts.quota
            ? (0, config_1.parseAmount)(opts.quota, config.decimals)
            : new bn_js_1.default(0); // 0 = unlimited
        const sig = await stable.addMinter(new web3_js_1.PublicKey(address), quota, authority);
        const quotaDisplay = quota.isZero()
            ? "unlimited"
            : display.fmtAmount(quota, config.decimals);
        spin.succeed(`Added minter ${display.shortKey(address)} (quota: ${quotaDisplay}/epoch)`);
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Failed to add minter");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// REMOVE
// ═══════════════════════════════════════════════════════════════
async function mintersRemoveCommand(address, opts) {
    const spin = display.spinner("Removing minter");
    try {
        const stable = await loadStable(opts);
        const authority = (0, config_1.loadKeypair)(opts.parent?.opts?.keypair || opts.keypair);
        const sig = await stable.removeMinter(new web3_js_1.PublicKey(address), authority);
        spin.succeed(`Removed minter ${display.shortKey(address)}`);
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Failed to remove minter");
        display.error(err.message || err);
        process.exit(1);
    }
}
