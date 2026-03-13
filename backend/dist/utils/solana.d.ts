import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import pino from "pino";
import { AppConfig } from "../config";
export interface SolanaContext {
    connection: Connection;
    stablecoin: SolanaStablecoin;
    authority: Keypair | null;
    configPda: PublicKey;
}
/**
 * Initialize the Solana connection and load the stablecoin instance.
 * Called once at server startup.
 */
export declare function initSolana(config: AppConfig, logger: pino.Logger): Promise<SolanaContext>;
