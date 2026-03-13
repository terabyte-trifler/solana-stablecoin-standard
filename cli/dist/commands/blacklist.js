"use strict";
// cli/src/commands/blacklist.ts
//
// SSS-2 compliance commands: blacklist add/remove/check, seize.
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
exports.blacklistAddCommand = blacklistAddCommand;
exports.blacklistRemoveCommand = blacklistRemoveCommand;
exports.blacklistCheckCommand = blacklistCheckCommand;
exports.blacklistListCommand = blacklistListCommand;
exports.seizeCommand = seizeCommand;
const web3_js_1 = require("@solana/web3.js");
const sss_token_1 = require("@stbr/sss-token");
const config_1 = require("../config");
const display = __importStar(require("../display"));
async function loadStable(opts) {
    const connection = (0, config_1.getConnection)(opts.parent?.parent?.opts?.url || opts.parent?.opts?.url || opts.url);
    const configPda = (0, config_1.resolveConfigPda)(opts.parent?.parent?.opts?.config || opts.parent?.opts?.config || opts.config);
    const wallet = (0, config_1.loadKeypair)(opts.parent?.parent?.opts?.keypair || opts.parent?.opts?.keypair || opts.keypair);
    return sss_token_1.SolanaStablecoin.load(connection, configPda, wallet);
}
// ═══════════════════════════════════════════════════════════════
// BLACKLIST ADD
// ═══════════════════════════════════════════════════════════════
async function blacklistAddCommand(address, opts) {
    const spin = display.spinner("Adding to blacklist");
    try {
        const stable = await loadStable(opts);
        const authority = (0, config_1.loadKeypair)(opts.parent?.parent?.opts?.keypair || opts.keypair);
        if (!opts.reason) {
            throw new Error("--reason is required (e.g., --reason \"OFAC SDN match\")");
        }
        const sig = await stable.compliance.blacklistAdd(new web3_js_1.PublicKey(address), opts.reason, authority);
        spin.succeed(`Blacklisted: ${display.shortKey(address)}`);
        display.field("Reason", opts.reason);
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Blacklist add failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// BLACKLIST REMOVE
// ═══════════════════════════════════════════════════════════════
async function blacklistRemoveCommand(address, opts) {
    const spin = display.spinner("Removing from blacklist");
    try {
        const stable = await loadStable(opts);
        const authority = (0, config_1.loadKeypair)(opts.parent?.parent?.opts?.keypair || opts.keypair);
        const sig = await stable.compliance.blacklistRemove(new web3_js_1.PublicKey(address), authority);
        spin.succeed(`Removed from blacklist: ${display.shortKey(address)}`);
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Blacklist remove failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// BLACKLIST CHECK
// ═══════════════════════════════════════════════════════════════
async function blacklistCheckCommand(address, opts) {
    try {
        const stable = await loadStable(opts);
        const pubkey = new web3_js_1.PublicKey(address);
        const isBlacklisted = await stable.compliance.isBlacklisted(pubkey);
        if (isBlacklisted) {
            const entry = await stable.compliance.getBlacklistEntry(pubkey);
            display.warn(`${display.shortKey(address)} is BLACKLISTED`);
            if (entry) {
                display.field("Reason", entry.reason);
                display.field("Blacklisted At", display.fmtTimestamp(entry.blacklistedAt));
                display.field("Blacklisted By", display.shortKey(entry.blacklistedBy));
            }
        }
        else {
            display.success(`${display.shortKey(address)} is NOT blacklisted`);
        }
    }
    catch (err) {
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// BLACKLIST LIST — show all blacklisted addresses
// ═══════════════════════════════════════════════════════════════
async function blacklistListCommand(opts) {
    const spin = display.spinner("Fetching blacklist");
    try {
        const stable = await loadStable(opts);
        const entries = await stable.compliance.getAllBlacklisted();
        spin.stop();
        if (entries.length === 0) {
            display.info("Blacklist is empty");
            return;
        }
        display.header(`Blacklisted Addresses (${entries.length})`);
        display.table(["Address", "Reason", "Date", "By"], entries.map((e) => [
            display.shortKey(e.address),
            e.reason.length > 30 ? e.reason.slice(0, 27) + "..." : e.reason,
            display.fmtTimestamp(e.blacklistedAt),
            display.shortKey(e.blacklistedBy),
        ]));
        console.log();
    }
    catch (err) {
        spin.fail("Failed to fetch blacklist");
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// SEIZE
// ═══════════════════════════════════════════════════════════════
async function seizeCommand(address, opts) {
    const spin = display.spinner("Seizing tokens");
    try {
        const stable = await loadStable(opts);
        const config = await stable.getConfig();
        const authority = (0, config_1.loadKeypair)(opts.parent?.opts?.keypair || opts.keypair);
        if (!opts.to) {
            throw new Error("--to <treasury_token_account> is required");
        }
        if (!opts.amount) {
            throw new Error("--amount <amount> is required");
        }
        const amount = (0, config_1.parseAmount)(opts.amount, config.decimals);
        const sig = await stable.compliance.seize({
            from: new web3_js_1.PublicKey(address),
            to: new web3_js_1.PublicKey(opts.to),
            amount,
            authority,
        });
        spin.succeed(`Seized ${display.fmtAmount(amount, config.decimals)} ${config.symbol} from ${display.shortKey(address)}`);
        display.field("Destination", display.shortKey(opts.to));
        display.txLink(sig);
    }
    catch (err) {
        spin.fail("Seizure failed");
        display.error(err.message || err);
        process.exit(1);
    }
}
