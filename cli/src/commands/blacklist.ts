// cli/src/commands/blacklist.ts
//
// SSS-2 compliance commands: blacklist add/remove/check, seize.

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { loadKeypair, getConnection, resolveConfigPda, parseAmount } from "../config";
import * as display from "../display";

async function loadStable(opts: any): Promise<SolanaStablecoin> {
  const connection = getConnection(opts.parent?.parent?.opts?.url || opts.parent?.opts?.url || opts.url);
  const configPda = resolveConfigPda(opts.parent?.parent?.opts?.config || opts.parent?.opts?.config || opts.config);
  const wallet = loadKeypair(opts.parent?.parent?.opts?.keypair || opts.parent?.opts?.keypair || opts.keypair);
  return SolanaStablecoin.load(connection, configPda, wallet);
}

// ═══════════════════════════════════════════════════════════════
// BLACKLIST ADD
// ═══════════════════════════════════════════════════════════════

export async function blacklistAddCommand(
  address: string,
  opts: any
): Promise<void> {
  const spin = display.spinner("Adding to blacklist");
  try {
    const stable = await loadStable(opts);
    const authority = loadKeypair(opts.parent?.parent?.opts?.keypair || opts.keypair);

    if (!opts.reason) {
      throw new Error("--reason is required (e.g., --reason \"OFAC SDN match\")");
    }

    const sig = await stable.compliance.blacklistAdd(
      new PublicKey(address),
      opts.reason,
      authority
    );

    spin.succeed(`Blacklisted: ${display.shortKey(address)}`);
    display.field("Reason", opts.reason);
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Blacklist add failed");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// BLACKLIST REMOVE
// ═══════════════════════════════════════════════════════════════

export async function blacklistRemoveCommand(
  address: string,
  opts: any
): Promise<void> {
  const spin = display.spinner("Removing from blacklist");
  try {
    const stable = await loadStable(opts);
    const authority = loadKeypair(opts.parent?.parent?.opts?.keypair || opts.keypair);

    const sig = await stable.compliance.blacklistRemove(
      new PublicKey(address),
      authority
    );

    spin.succeed(`Removed from blacklist: ${display.shortKey(address)}`);
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Blacklist remove failed");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// BLACKLIST CHECK
// ═══════════════════════════════════════════════════════════════

export async function blacklistCheckCommand(
  address: string,
  opts: any
): Promise<void> {
  try {
    const stable = await loadStable(opts);
    const pubkey = new PublicKey(address);

    const isBlacklisted = await stable.compliance.isBlacklisted(pubkey);

    if (isBlacklisted) {
      const entry = await stable.compliance.getBlacklistEntry(pubkey);
      display.warn(`${display.shortKey(address)} is BLACKLISTED`);
      if (entry) {
        display.field("Reason", entry.reason);
        display.field("Blacklisted At", display.fmtTimestamp(entry.blacklistedAt));
        display.field("Blacklisted By", display.shortKey(entry.blacklistedBy));
      }
    } else {
      display.success(`${display.shortKey(address)} is NOT blacklisted`);
    }
  } catch (err: any) {
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// BLACKLIST LIST — show all blacklisted addresses
// ═══════════════════════════════════════════════════════════════

export async function blacklistListCommand(opts: any): Promise<void> {
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
    display.table(
      ["Address", "Reason", "Date", "By"],
      entries.map((e) => [
        display.shortKey(e.address),
        e.reason.length > 30 ? e.reason.slice(0, 27) + "..." : e.reason,
        display.fmtTimestamp(e.blacklistedAt),
        display.shortKey(e.blacklistedBy),
      ])
    );
    console.log();
  } catch (err: any) {
    spin.fail("Failed to fetch blacklist");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// SEIZE
// ═══════════════════════════════════════════════════════════════

export async function seizeCommand(
  address: string,
  opts: any
): Promise<void> {
  const spin = display.spinner("Seizing tokens");
  try {
    const stable = await loadStable(opts);
    const config = await stable.getConfig();
    const authority = loadKeypair(opts.parent?.opts?.keypair || opts.keypair);

    if (!opts.to) {
      throw new Error("--to <treasury_token_account> is required");
    }
    if (!opts.amount) {
      throw new Error("--amount <amount> is required");
    }

    const amount = parseAmount(opts.amount, config.decimals);

    const sig = await stable.compliance.seize({
      from: new PublicKey(address),
      to: new PublicKey(opts.to),
      amount,
      authority,
    });

    spin.succeed(
      `Seized ${display.fmtAmount(amount, config.decimals)} ${config.symbol} from ${display.shortKey(address)}`
    );
    display.field("Destination", display.shortKey(opts.to));
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Seizure failed");
    display.error(err.message || err);
    process.exit(1);
  }
}
