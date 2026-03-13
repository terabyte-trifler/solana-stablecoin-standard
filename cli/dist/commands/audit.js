"use strict";
// cli/src/commands/audit.ts
//
// Audit log querying — reads on-chain events from transaction history.
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
exports.auditLogCommand = auditLogCommand;
const sss_token_1 = require("@stbr/sss-token");
const config_1 = require("../config");
const display = __importStar(require("../display"));
async function auditLogCommand(opts) {
    const spin = display.spinner("Fetching audit log");
    try {
        const connection = (0, config_1.getConnection)(opts.parent?.opts?.url || opts.url);
        const configPda = (0, config_1.resolveConfigPda)(opts.parent?.opts?.config || opts.config);
        const stable = await sss_token_1.SolanaStablecoin.load(connection, configPda);
        if (!stable.isCompliant) {
            display.warn("Audit log is available on all presets, but richest on SSS-2");
        }
        const filters = {};
        if (opts.action)
            filters.eventType = mapActionToEvent(opts.action);
        if (opts.limit)
            filters.limit = parseInt(opts.limit, 10);
        const events = await stable.compliance.getAuditLog(filters);
        spin.succeed(`Found ${events.length} event(s)`);
        if (events.length === 0) {
            display.info("No events found matching filters");
            return;
        }
        // Display events
        for (const event of events) {
            console.log();
            display.info(`${event.name}`);
            display.field("Slot", event.slot);
            display.field("Time", event.blockTime ? display.fmtTimestamp(event.blockTime) : "unknown");
            display.field("Tx", display.shortKey(event.signature));
            // Show key data fields
            for (const [key, value] of Object.entries(event.data)) {
                if (key === "timestamp" || key === "config")
                    continue; // Skip redundant fields
                const displayValue = value && typeof value === "object" && "toBase58" in value
                    ? display.shortKey(value.toBase58())
                    : String(value);
                display.field(`  ${key}`, displayValue);
            }
        }
        // Offer export
        if (opts.export) {
            const json = await stable.compliance.exportAuditLog(filters);
            const fs = require("fs");
            fs.writeFileSync(opts.export, json);
            console.log();
            display.success(`Audit log exported to ${opts.export}`);
        }
        console.log();
    }
    catch (err) {
        spin.fail("Failed to fetch audit log");
        display.error(err.message || err);
        process.exit(1);
    }
}
/**
 * Map short action names to event type names.
 */
function mapActionToEvent(action) {
    const map = {
        mint: "TokensMinted",
        burn: "TokensBurned",
        freeze: "AccountFrozen",
        thaw: "AccountThawed",
        pause: "StablecoinPaused",
        unpause: "StablecoinUnpaused",
        blacklist: "AddressBlacklisted",
        unblacklist: "AddressRemovedFromBlacklist",
        seize: "TokensSeized",
        "minter-add": "MinterAdded",
        "minter-remove": "MinterRemoved",
        role: "RoleGranted",
        authority: "AuthorityTransferProposed",
    };
    return map[action] || action;
}
