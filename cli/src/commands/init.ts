// cli/src/commands/init.ts

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { SolanaStablecoin, RoleType } from "@stbr/sss-token";
import {
  loadKeypair,
  getConnection,
  loadTomlConfig,
  saveActiveConfig,
  resolveRpcUrl,
} from "../config";
import * as display from "../display";

interface InitOptions {
  preset?: string;
  custom?: string;
  name?: string;
  symbol?: string;
  decimals?: string;
  uri?: string;
  keypair?: string;
  url?: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const spin = display.spinner("Creating stablecoin");

  try {
    const connection = getConnection(opts.url);
    const authority = loadKeypair(opts.keypair);

    let createOpts: any;

    if (opts.custom) {
      // ── Custom TOML config ──────────────────────────────────
      const toml = loadTomlConfig(opts.custom);
      createOpts = {
        name: toml.token.name,
        symbol: toml.token.symbol,
        decimals: toml.token.decimals,
        uri: toml.token.uri || "",
        authority,
        extensions: {
          enablePermanentDelegate: toml.features.permanent_delegate,
          enableTransferHook: toml.features.transfer_hook,
          defaultAccountFrozen: toml.features.default_account_frozen,
        },
      };
    } else {
      // ── Preset or flags ─────────────────────────────────────
      const preset = (opts.preset?.toUpperCase() === "SSS-2" || opts.preset === "sss-2")
        ? "SSS_2" as const
        : "SSS_1" as const;

      if (!opts.name || !opts.symbol) {
        throw new Error("--name and --symbol are required (or use --custom config.toml)");
      }

      createOpts = {
        preset,
        name: opts.name,
        symbol: opts.symbol,
        decimals: parseInt(opts.decimals || "6", 10),
        uri: opts.uri || "",
        authority,
      };
    }

    // ── Create stablecoin ───────────────────────────────────
    const stable = await SolanaStablecoin.create(connection, createOpts);

    // ── Set up initial roles from TOML (if applicable) ──────
    if (opts.custom) {
      const toml = loadTomlConfig(opts.custom);
      if (toml.roles) {
        spin.succeed("Stablecoin created, configuring roles...");
        const roleSpin = display.spinner("Setting up roles");

        // Add minters
        if (toml.roles.minters) {
          for (const m of toml.roles.minters) {
            await stable.addMinter(
              new PublicKey(m.address),
              new BN(m.quota),
              authority
            );
          }
        }
        // Add pausers
        if (toml.roles.pausers) {
          for (const p of toml.roles.pausers) {
            await stable.grantRole(RoleType.Pauser, new PublicKey(p), authority);
          }
        }
        // Add burners
        if (toml.roles.burners) {
          for (const b of toml.roles.burners) {
            await stable.grantRole(RoleType.Burner, new PublicKey(b), authority);
          }
        }
        // Add blacklisters (SSS-2 only)
        if (toml.roles.blacklisters && stable.isCompliant) {
          for (const bl of toml.roles.blacklisters) {
            await stable.grantRole(RoleType.Blacklister, new PublicKey(bl), authority);
          }
        }
        // Add seizers (SSS-2 only)
        if (toml.roles.seizers && stable.isCompliant) {
          for (const s of toml.roles.seizers) {
            await stable.grantRole(RoleType.Seizer, new PublicKey(s), authority);
          }
        }
        roleSpin.succeed("Roles configured");
      }
    }

    // ── Save active config ──────────────────────────────────
    const rpcUrl = resolveRpcUrl(opts.url);
    saveActiveConfig({
      configPda: stable.configPda.toBase58(),
      mint: stable.mint.toBase58(),
      network: rpcUrl,
    });

    spin.succeed("Stablecoin created successfully");

    // ── Display result ──────────────────────────────────────
    const config = await stable.getConfig();
    display.header(`${config.name} (${config.symbol})`);
    display.field("Preset", stable.isCompliant ? "SSS-2 Compliant" : "SSS-1 Minimal");
    display.field("Mint", stable.mint.toBase58());
    display.field("Config PDA", stable.configPda.toBase58());
    display.field("Decimals", config.decimals);
    display.field("Authority", display.shortKey(config.masterAuthority));
    display.field("Permanent Delegate", config.enablePermanentDelegate);
    display.field("Transfer Hook", config.enableTransferHook);
    display.field("Default Frozen", config.defaultAccountFrozen);
    console.log();
    display.info(`Config saved to ~/.sss-token/active.json`);

  } catch (err: any) {
    spin.fail("Failed to create stablecoin");
    display.error(err.message || err);
    process.exit(1);
  }
}
