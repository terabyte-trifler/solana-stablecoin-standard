// cli/src/commands/status.ts
//
// Read-only commands: status, supply, holders

import BN from "bn.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import {
  loadKeypair,
  getConnection,
  resolveConfigPda,
  parseAmount,
} from "../config";
import * as display from "../display";

async function loadStable(opts: any): Promise<SolanaStablecoin> {
  const connection = getConnection(opts.url);
  const configPda = resolveConfigPda(opts.config);
  return SolanaStablecoin.load(connection, configPda);
}

// ═══════════════════════════════════════════════════════════════
// STATUS — full overview of the stablecoin
// ═══════════════════════════════════════════════════════════════

export async function statusCommand(opts: any): Promise<void> {
  try {
    const stable = await loadStable(opts);
    const config = await stable.getConfig();
    const roles = await stable.getRoles();

    display.header(`${config.name} (${config.symbol})`);

    // Identity
    display.field("Mint", config.mint.toBase58());
    display.field("Config PDA", stable.configPda.toBase58());
    display.field("Decimals", config.decimals);
    if (config.uri) display.field("Metadata URI", config.uri);

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
    display.field(
      "Pending Transfer",
      config.pendingMasterAuthority
        ? config.pendingMasterAuthority.toBase58()
        : "none"
    );

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
  } catch (err: any) {
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// SUPPLY — just the total supply number
// ═══════════════════════════════════════════════════════════════

export async function supplyCommand(opts: any): Promise<void> {
  try {
    const stable = await loadStable(opts);
    const config = await stable.getConfig();
    const formatted = display.fmtAmount(config.totalSupply, config.decimals);
    console.log(`${formatted} ${config.symbol}`);
  } catch (err: any) {
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// HOLDERS — list all token holders
// ═══════════════════════════════════════════════════════════════

export async function holdersCommand(opts: any): Promise<void> {
  const spin = display.spinner("Fetching holders");
  try {
    const stable = await loadStable(opts);
    const config = await stable.getConfig();

    const minBalance = opts.minBalance
      ? parseAmount(opts.minBalance, config.decimals)
      : undefined;

    const holders = await stable.getHolders(minBalance);
    spin.succeed(`Found ${holders.length} holder(s)`);

    if (holders.length === 0) {
      display.info("No token holders found");
      return;
    }

    // Sort by balance descending
    holders.sort((a, b) => (b.balance.gt(a.balance) ? 1 : -1));

    display.table(
      ["Owner", "Token Account", "Balance", "Frozen"],
      holders.map((h) => [
        display.shortKey(h.owner),
        display.shortKey(h.tokenAccount),
        display.fmtAmount(h.balance, config.decimals),
        h.isFrozen ? "🔒" : "",
      ])
    );
    console.log();
  } catch (err: any) {
    spin.fail("Failed to fetch holders");
    display.error(err.message || err);
    process.exit(1);
  }
}
