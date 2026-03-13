import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
/**
 * Load a Keypair from a file path.
 *
 * Supports:
 * - JSON array format: [1,2,3,...,64] (Solana CLI standard)
 * - Base58 private key string
 *
 * If no path given, falls back to ~/.config/solana/id.json
 */
export declare function loadKeypair(keypairPath?: string): Keypair;
/**
 * Resolve the Solana RPC URL.
 *
 * Priority:
 * 1. --url flag
 * 2. SOLANA_RPC_URL env var
 * 3. Solana CLI config (~/.config/solana/cli/config.yml)
 * 4. Default: devnet
 */
export declare function resolveRpcUrl(urlFlag?: string): string;
/**
 * Create a Solana connection with the resolved URL.
 */
export declare function getConnection(urlFlag?: string): Connection;
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
        master_authority?: string;
        minters?: Array<{
            address: string;
            quota: number;
        }>;
        burners?: string[];
        pausers?: string[];
        blacklisters?: string[];
        seizers?: string[];
    };
}
/**
 * Parse a TOML config file for custom stablecoin initialization.
 */
export declare function loadTomlConfig(filePath: string): TomlConfig;
export interface ActiveConfig {
    configPda: string;
    mint: string;
    network: string;
}
/** Save the active stablecoin config after init. */
export declare function saveActiveConfig(config: ActiveConfig): void;
/** Load the active stablecoin config. Throws if none saved. */
export declare function loadActiveConfig(): ActiveConfig;
/**
 * Resolve the config PDA — from flag, or from saved active config.
 */
export declare function resolveConfigPda(configFlag?: string): PublicKey;
/**
 * Parse a human-readable amount string into BN smallest units.
 *
 * Supports:
 * - "1000000" → BN(1000000) (raw)
 * - "100.5" with decimals=6 → BN(100500000)
 *
 * If the string contains a decimal point, we multiply by 10^decimals.
 */
export declare function parseAmount(amountStr: string, decimals?: number): BN;
/**
 * Format a BN amount into human-readable string.
 */
export declare function formatAmount(amount: BN, decimals?: number): string;
