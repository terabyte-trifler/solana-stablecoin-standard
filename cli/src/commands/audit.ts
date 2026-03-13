// cli/src/commands/audit.ts
//
// Audit log querying — reads on-chain events from transaction history.

import { SolanaStablecoin } from "@stbr/sss-token";
import { AuditLogFilters } from "@stbr/sss-token";
import { loadKeypair, getConnection, resolveConfigPda } from "../config";
import * as display from "../display";

export async function auditLogCommand(opts: any): Promise<void> {
  const spin = display.spinner("Fetching audit log");
  try {
    const connection = getConnection(opts.parent?.opts?.url || opts.url);
    const configPda = resolveConfigPda(opts.parent?.opts?.config || opts.config);
    const stable = await SolanaStablecoin.load(connection, configPda);

    if (!stable.isCompliant) {
      display.warn("Audit log is available on all presets, but richest on SSS-2");
    }

    const filters: AuditLogFilters = {};
    if (opts.action) filters.eventType = mapActionToEvent(opts.action);
    if (opts.limit) filters.limit = parseInt(opts.limit, 10);

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
        if (key === "timestamp" || key === "config") continue; // Skip redundant fields
        const displayValue = value && typeof value === "object" && "toBase58" in (value as any)
          ? display.shortKey((value as any).toBase58())
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
  } catch (err: any) {
    spin.fail("Failed to fetch audit log");
    display.error(err.message || err);
    process.exit(1);
  }
}

/**
 * Map short action names to event type names.
 */
function mapActionToEvent(action: string): AuditLogFilters["eventType"] {
  const map: Record<string, AuditLogFilters["eventType"]> = {
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
  return map[action] || (action as any);
}
