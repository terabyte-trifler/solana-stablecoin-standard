// cli/src/config.ts
//
// Handles all configuration loading for the CLI:
// - Keypair loading from file paths or Solana CLI default
// - TOML config file parsing for custom initialization
// - RPC URL resolution (from flag, env var, or Solana CLI config)
// - Config PDA address persistence (saved after init, loaded for operations)

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import BN from "bn.js";

// ============================================================================
// KEYPAIR LOADING
// ============================================================================

/**
 * Load a Keypair from a file path.
 *
 * Supports:
 * - JSON array format: [1,2,3,...,64] (Solana CLI standard)
 * - Base58 private key string
 *
 * If no path given, falls back to ~/.config/solana/id.json
 */
export function loadKeypair(keypairPath?: string): Keypair {
  const resolvedPath =
    keypairPath ??
    path.join(os.homedir(), ".config", "solana", "id.json");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Keypair file not found: ${resolvedPath}\n` +
        `Run 'solana-keygen new' to create one, or pass --keypair <path>`
    );
  }

  const raw = fs.readFileSync(resolvedPath, "utf-8").trim();

  // Try JSON array format first
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
  } catch {
    // Not JSON, try base58
  }

  // Try base58 secret key
  try {
    const { bs58 } = require("@coral-xyz/anchor/dist/cjs/utils/bytes");
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    throw new Error(`Cannot parse keypair file: ${resolvedPath}`);
  }
}

// ============================================================================
// RPC CONNECTION
// ============================================================================

/**
 * Resolve the Solana RPC URL.
 *
 * Priority:
 * 1. --url flag
 * 2. SOLANA_RPC_URL env var
 * 3. Solana CLI config (~/.config/solana/cli/config.yml)
 * 4. Default: devnet
 */
export function resolveRpcUrl(urlFlag?: string): string {
  if (urlFlag) {
    // Handle shorthand cluster names
    if (urlFlag === "devnet") return clusterApiUrl("devnet");
    if (urlFlag === "mainnet" || urlFlag === "mainnet-beta")
      return clusterApiUrl("mainnet-beta");
    if (urlFlag === "testnet") return clusterApiUrl("testnet");
    if (urlFlag === "localnet" || urlFlag === "localhost")
      return "http://127.0.0.1:8899";
    return urlFlag; // Assume it's a full URL
  }

  if (process.env.SOLANA_RPC_URL) {
    return process.env.SOLANA_RPC_URL;
  }

  // Try Solana CLI config
  const cliConfigPath = path.join(
    os.homedir(),
    ".config",
    "solana",
    "cli",
    "config.yml"
  );
  if (fs.existsSync(cliConfigPath)) {
    const content = fs.readFileSync(cliConfigPath, "utf-8");
    const match = content.match(/json_rpc_url:\s*"?([^\s"]+)"?/);
    if (match) return match[1];
  }

  return clusterApiUrl("devnet");
}

/**
 * Create a Solana connection with the resolved URL.
 */
export function getConnection(urlFlag?: string): Connection {
  const url = resolveRpcUrl(urlFlag);
  return new Connection(url, "confirmed");
}

// ============================================================================
// TOML CONFIG PARSING
// ============================================================================

/** Parsed structure from a TOML config file. */
export interface TomlConfig {
  token: {
    name: string;
    symbol: string;
    decimals: number;
    uri?: string;
  };
  features: {
    permanent_delegate: boolean;
    transfer_hook: boolean;
    default_account_frozen: boolean;
  };
  roles?: {
    master_authority?: string; // keypair path
    minters?: Array<{ address: string; quota: number }>;
    burners?: string[];
    pausers?: string[];
    blacklisters?: string[];
    seizers?: string[];
  };
}

/**
 * Parse a TOML config file for custom stablecoin initialization.
 */
export function loadTomlConfig(filePath: string): TomlConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const toml = require("toml");
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = toml.parse(content);

  // Validate required fields
  if (!parsed.token?.name) throw new Error("Config missing: [token].name");
  if (!parsed.token?.symbol) throw new Error("Config missing: [token].symbol");

  return {
    token: {
      name: parsed.token.name,
      symbol: parsed.token.symbol,
      decimals: parsed.token.decimals ?? 6,
      uri: parsed.token.uri ?? "",
    },
    features: {
      permanent_delegate: parsed.features?.permanent_delegate ?? false,
      transfer_hook: parsed.features?.transfer_hook ?? false,
      default_account_frozen: parsed.features?.default_account_frozen ?? false,
    },
    roles: parsed.roles,
  };
}

// ============================================================================
// CONFIG PDA PERSISTENCE
// ============================================================================
// After `sss-token init`, we save the config PDA and mint address to a
// local file so subsequent commands know which stablecoin to operate on.
// This is similar to how Anchor saves program IDs.

const STATE_DIR = path.join(os.homedir(), ".sss-token");
const STATE_FILE = path.join(STATE_DIR, "active.json");

export interface ActiveConfig {
  configPda: string;
  mint: string;
  network: string;
}

/** Save the active stablecoin config after init. */
export function saveActiveConfig(config: ActiveConfig): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(config, null, 2));
}

/** Load the active stablecoin config. Throws if none saved. */
export function loadActiveConfig(): ActiveConfig {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      "No active stablecoin configured.\n" +
        "Run 'sss-token init' first, or pass --config <pubkey> to specify one."
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
}

/**
 * Resolve the config PDA — from flag, or from saved active config.
 */
export function resolveConfigPda(configFlag?: string): PublicKey {
  if (configFlag) return new PublicKey(configFlag);
  const active = loadActiveConfig();
  return new PublicKey(active.configPda);
}

// ============================================================================
// AMOUNT PARSING
// ============================================================================

/**
 * Parse a human-readable amount string into BN smallest units.
 *
 * Supports:
 * - "1000000" → BN(1000000) (raw)
 * - "100.5" with decimals=6 → BN(100500000)
 *
 * If the string contains a decimal point, we multiply by 10^decimals.
 */
export function parseAmount(amountStr: string, decimals: number = 6): BN {
  if (amountStr.includes(".")) {
    const parts = amountStr.split(".");
    const whole = parts[0];
    const frac = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
    return new BN(whole + frac);
  }
  return new BN(amountStr);
}

/**
 * Format a BN amount into human-readable string.
 */
export function formatAmount(amount: BN, decimals: number = 6): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
