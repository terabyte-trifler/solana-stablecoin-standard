"use strict";
// cli/src/commands/operations.ts
//
// Core token operations: mint, burn, freeze, thaw, pause, unpause.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintCommand = mintCommand;
exports.burnCommand = burnCommand;
exports.freezeCommand = freezeCommand;
exports.thawCommand = thawCommand;
exports.pauseCommand = pauseCommand;
exports.unpauseCommand = unpauseCommand;
const web3_js_1 = require("@solana/web3.js");
const sss_token_1 = require("@stbr/sss-token");
const config_1 = require("../config");
const display = __importStar(require("../display"));
// Helper to load an active stablecoin instance
async function loadStable(opts) {
    const connection = (0, config_1.getConnection)(opts.url);
    const configPda = (0, config_1.resolveConfigPda)(opts.config);
    const wallet = (0, config_1.loadKeypair)(opts.keypair);
    return sss_token_1.SolanaStablecoin.load(connection, configPda, wallet);
}
// ═══════════════════════════════════════════════════════════════
// MINT
// ═══════════════════════════════════════════════════════════════
async function mintCommand(recipient, amountStr, opts) {
    const spin = display.spinner("Minting tokens");
    try {
        const stable = await loadStable(opts);
        const config = await stable.getConfig();
        const minterKeypair = opts.minter
            ? (0, config_1.loadKeypair)(opts.minter)
            : (0, config_1.loadKeypair)(opts.keypair);
        const amount = (0, config_1.parseAmount)(amountStr, config.decimals);
        const sig = await stable.mintTokens({
            recipient: new web3_js_1.PublicKey(recipient),
            amount,
            minter: minterKeypair,
        });
        spin.succeed(`Minted ${display.fmtAmount(amount, config.decimals)} ${config.symbol} → ${display.shortKey(recipient)}`);
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Mint failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// BURN
// ═══════════════════════════════════════════════════════════════
async function burnCommand(amountStr, opts) {
    const spin = display.spinner("Burning tokens");
    try {
        const stable = await loadStable(opts);
        const config = await stable.getConfig();
        const burner = (0, config_1.loadKeypair)(opts.keypair);
        const amount = (0, config_1.parseAmount)(amountStr, config.decimals);
        const sig = await stable.burn({ amount, burner });
        spin.succeed(`Burned ${display.fmtAmount(amount, config.decimals)} ${config.symbol}`);
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Burn failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// FREEZE
// ═══════════════════════════════════════════════════════════════
async function freezeCommand(address, opts) {
    const spin = display.spinner("Freezing account");
    try {
        const stable = await loadStable(opts);
        const authority = (0, config_1.loadKeypair)(opts.keypair);
        const sig = await stable.freezeAccount(new web3_js_1.PublicKey(address), authority);
        spin.succeed(`Frozen: ${display.shortKey(address)}`);
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Freeze failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// THAW
// ═══════════════════════════════════════════════════════════════
async function thawCommand(address, opts) {
    const spin = display.spinner("Thawing account");
    try {
        const stable = await loadStable(opts);
        const authority = (0, config_1.loadKeypair)(opts.keypair);
        const sig = await stable.thawAccount(new web3_js_1.PublicKey(address), authority);
        spin.succeed(`Thawed: ${display.shortKey(address)}`);
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Thaw failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// PAUSE
// ═══════════════════════════════════════════════════════════════
async function pauseCommand(opts) {
    const spin = display.spinner("Pausing stablecoin");
    try {
        const stable = await loadStable(opts);
        const authority = (0, config_1.loadKeypair)(opts.keypair);
        const sig = await stable.pause(authority);
        spin.succeed("Stablecoin PAUSED — mint/burn operations halted");
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Pause failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// UNPAUSE
// ═══════════════════════════════════════════════════════════════
async function unpauseCommand(opts) {
    const spin = display.spinner("Unpausing stablecoin");
    try {
        const stable = await loadStable(opts);
        const authority = (0, config_1.loadKeypair)(opts.keypair);
        const sig = await stable.unpause(authority);
        spin.succeed("Stablecoin UNPAUSED — operations resumed");
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Unpause failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
