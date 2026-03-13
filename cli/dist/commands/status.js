"use strict";
// cli/src/commands/status.ts
//
// Read-only commands: status, supply, holders
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
exports.statusCommand = statusCommand;
exports.supplyCommand = supplyCommand;
exports.holdersCommand = holdersCommand;
const sss_token_1 = require("@stbr/sss-token");
const config_1 = require("../config");
const display = __importStar(require("../display"));
async function loadStable(opts) {
    const connection = (0, config_1.getConnection)(opts.url);
    const configPda = (0, config_1.resolveConfigPda)(opts.config);
    return sss_token_1.SolanaStablecoin.load(connection, configPda);
}
// ═══════════════════════════════════════════════════════════════
// STATUS — full overview of the stablecoin
// ═══════════════════════════════════════════════════════════════
async function statusCommand(opts) {
    try {
        const stable = await loadStable(opts);
        const config = await stable.getConfig();
        const roles = await stable.getRoles();
        display.header(`${config.name} (${config.symbol})`);
        // Identity
        display.field("Mint", config.mint.toBase58());
        display.field("Config PDA", stable.configPda.toBase58());
        display.field("Decimals", config.decimals);
        if (config.uri)
            display.field("Metadata URI", config.uri);
        // Status
        display.header("Status");
        display.field("Total Supply", display.fmtAmount(config.totalSupply, config.decimals));
        display.field("Paused", config.isPaused);
        display.field("Preset", stable.isCompliant ? "SSS-2 Compliant" : "SSS-1 Minimal");
        // Features
        display.header("Features");
        display.field("Permanent Delegate", config.enablePermanentDelegate);
        display.field("Transfer Hook", config.enableTransferHook);
        display.field("Default Frozen", config.defaultAccountFrozen);
        // Authority
        display.header("Authority");
        display.field("Master Authority", config.masterAuthority.toBase58());
        display.field("Pending Transfer", config.pendingMasterAuthority
            ? config.pendingMasterAuthority.toBase58()
            : "none");
        // Roles summary
        display.header("Roles");
        display.field("Minters", `${roles.minters.length} registered`);
        display.field("Burners", `${roles.burners.length} registered`);
        display.field("Pausers", `${roles.pausers.length} registered`);
        if (stable.isCompliant) {
            display.field("Blacklisters", `${roles.blacklisters.length} registered`);
            display.field("Seizers", `${roles.seizers.length} registered`);
        }
        console.log();
    }
    catch (err) {
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// SUPPLY — just the total supply number
// ═══════════════════════════════════════════════════════════════
async function supplyCommand(opts) {
    try {
        const stable = await loadStable(opts);
        const config = await stable.getConfig();
        const formatted = display.fmtAmount(config.totalSupply, config.decimals);
        console.log(`${formatted} ${config.symbol}`);
    }
    catch (err) {
        display.error(err.message || err);
        process.exit(1);
    }
}
// ═══════════════════════════════════════════════════════════════
// HOLDERS — list all token holders
// ═══════════════════════════════════════════════════════════════
async function holdersCommand(opts) {
    const spin = display.spinner("Fetching holders");
    try {
        const stable = await loadStable(opts);
        const config = await stable.getConfig();
        const minBalance = opts.minBalance
            ? (0, config_1.parseAmount)(opts.minBalance, config.decimals)
            : undefined;
        const holders = await stable.getHolders(minBalance);
        spin.succeed(`Found ${holders.length} holder(s)`);
        if (holders.length === 0) {
            display.info("No token holders found");
            return;
        }
        // Sort by balance descending
        holders.sort((a, b) => (b.balance.gt(a.balance) ? 1 : -1));
        display.table(["Owner", "Token Account", "Balance", "Frozen"], holders.map((h) => [
            display.shortKey(h.owner),
            display.shortKey(h.tokenAccount),
            display.fmtAmount(h.balance, config.decimals),
            h.isFrozen ? "🔒" : "",
        ]));
        console.log();
    }
    catch (err) {
        spin.fail("Failed to fetch holders");
        display.error(err.message || err);
        process.exit(1);
    }
}
