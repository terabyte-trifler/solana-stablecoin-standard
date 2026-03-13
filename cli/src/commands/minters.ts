// cli/src/commands/minters.ts

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { loadKeypair, getConnection, resolveConfigPda, parseAmount } from "../config";
import * as display from "../display";

async function loadStable(opts: any): Promise<SolanaStablecoin> {
  const connection = getConnection(opts.parent?.opts?.url || opts.url);
  const configPda = resolveConfigPda(opts.parent?.opts?.config || opts.config);
  const wallet = loadKeypair(opts.parent?.opts?.keypair || opts.keypair);
  return SolanaStablecoin.load(connection, configPda, wallet);
}

// ═══════════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════════

export async function mintersListCommand(opts: any): Promise<void> {
  try {
    const stable = await loadStable(opts);
    const config = await stable.getConfig();
    const roles = await stable.getRoles();

    if (roles.minters.length === 0) {
      display.info("No minters registered");
      return;
    }

    display.header(`Minters (${roles.minters.length})`);

    display.table(
      ["Address", "Quota/Epoch", "Minted", "Remaining", "Epoch"],
      roles.minters.map((m) => {
        const quotaStr = m.quota.isZero()
          ? "unlimited"
          : display.fmtAmount(m.quota, config.decimals);
        const mintedStr = display.fmtAmount(m.minted, config.decimals);
        const remaining = m.quota.isZero()
          ? "∞"
          : display.fmtAmount(
              m.quota.sub(BN.min(m.minted, m.quota)),
              config.decimals
            );
        return [
          display.shortKey(m.address),
          quotaStr,
          mintedStr,
          remaining,
          m.lastResetEpoch.toString(),
        ];
      })
    );
    console.log();
  } catch (err: any) {
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// ADD
// ═══════════════════════════════════════════════════════════════

export async function mintersAddCommand(
  address: string,
  opts: any
): Promise<void> {
  const spin = display.spinner("Adding minter");
  try {
    const stable = await loadStable(opts);
    const config = await stable.getConfig();
    const authority = loadKeypair(opts.parent?.opts?.keypair || opts.keypair);

    const quota = opts.quota
      ? parseAmount(opts.quota, config.decimals)
      : new BN(0); // 0 = unlimited

    const sig = await stable.addMinter(new PublicKey(address), quota, authority);

    const quotaDisplay = quota.isZero()
      ? "unlimited"
      : display.fmtAmount(quota, config.decimals);
    spin.succeed(
      `Added minter ${display.shortKey(address)} (quota: ${quotaDisplay}/epoch)`
    );
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Failed to add minter");
    display.error(err.message || err);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// REMOVE
// ═══════════════════════════════════════════════════════════════

export async function mintersRemoveCommand(
  address: string,
  opts: any
): Promise<void> {
  const spin = display.spinner("Removing minter");
  try {
    const stable = await loadStable(opts);
    const authority = loadKeypair(opts.parent?.opts?.keypair || opts.keypair);

    const sig = await stable.removeMinter(new PublicKey(address), authority);

    spin.succeed(`Removed minter ${display.shortKey(address)}`);
    display.txLink(sig);
  } catch (err: any) {
    spin.fail("Failed to remove minter");
    display.error(err.message || err);
    process.exit(1);
  }
}
