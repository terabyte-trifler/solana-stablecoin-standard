// cli/src/commands/operations.ts
//
// Core token operations: mint, burn, freeze, thaw, pause, unpause.

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import {
  loadKeypair,
  getConnection,
  resolveConfigPda,
  parseAmount,
} from "../config";
import * as display from "../display";

// Helper to load an active stablecoin instance
async function loadStable(opts: any): Promise<SolanaStablecoin> {
  const connection = getConnection(opts.url);
  const configPda = resolveConfigPda(opts.config);
  const wallet = loadKeypair(opts.keypair);
  return SolanaStablecoin.load(connection, configPda, wallet);
}

// ═══════════════════════════════════════════════════════════════
// MINT
// ═══════════════════════════════════════════════════════════════

export async function mintCommand(
  recipient: string,
  amountStr: string,
  opts: any,
): Promise<void> {
  const spin = display.spinner("Minting tokens");
  try {
    const stable = await loadStable(opts);
    const config = await stable.getConfig();
    const minterKeypair = opts.minter
      ? loadKeypair(opts.minter)
      : loadKeypair(opts.keypair);

    const amount = parseAmount(amountStr, config.decimals);

    const sig = await stable.mintTokens({
      recipient: new PublicKey(recipient),
      amount,
      minter: minterKeypair,
    });

    spin.succeed(
      `Minted ${display.fmtAmount(amount, config.decimals)} ${config.symbol} → ${display.shortKey(recipient)}`,
    );
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Mint failed");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// BURN
// ═══════════════════════════════════════════════════════════════

export async function burnCommand(amountStr: string, opts: any): Promise<void> {
  const spin = display.spinner("Burning tokens");
  try {
    const stable = await loadStable(opts);
    const config = await stable.getConfig();
    const burner = loadKeypair(opts.keypair);
    const amount = parseAmount(amountStr, config.decimals);

    const sig = await stable.burn({ amount, burner });

    spin.succeed(
      `Burned ${display.fmtAmount(amount, config.decimals)} ${config.symbol}`,
    );
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Burn failed");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// FREEZE
// ═══════════════════════════════════════════════════════════════

export async function freezeCommand(address: string, opts: any): Promise<void> {
  const spin = display.spinner("Freezing account");
  try {
    const stable = await loadStable(opts);
    const authority = loadKeypair(opts.keypair);

    const sig = await stable.freezeAccount(new PublicKey(address), authority);

    spin.succeed(`Frozen: ${display.shortKey(address)}`);
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Freeze failed");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// THAW
// ═══════════════════════════════════════════════════════════════

export async function thawCommand(address: string, opts: any): Promise<void> {
  const spin = display.spinner("Thawing account");
  try {
    const stable = await loadStable(opts);
    const authority = loadKeypair(opts.keypair);

    const sig = await stable.thawAccount(new PublicKey(address), authority);

    spin.succeed(`Thawed: ${display.shortKey(address)}`);
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Thaw failed");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// PAUSE
// ═══════════════════════════════════════════════════════════════

export async function pauseCommand(opts: any): Promise<void> {
  const spin = display.spinner("Pausing stablecoin");
  try {
    const stable = await loadStable(opts);
    const authority = loadKeypair(opts.keypair);

    const sig = await stable.pause(authority);

    spin.succeed("Stablecoin PAUSED — mint/burn operations halted");
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Pause failed");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// UNPAUSE
// ═══════════════════════════════════════════════════════════════

export async function unpauseCommand(opts: any): Promise<void> {
  const spin = display.spinner("Unpausing stablecoin");
  try {
    const stable = await loadStable(opts);
    const authority = loadKeypair(opts.keypair);

    const sig = await stable.unpause(authority);

    spin.succeed("Stablecoin UNPAUSED — operations resumed");
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Unpause failed");
    display.error(err.message || err);
    process.exit(1);
  }
}
