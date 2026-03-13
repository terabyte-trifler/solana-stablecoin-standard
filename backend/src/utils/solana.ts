// backend/src/utils/solana.ts
//
// Initializes the Solana connection and loads the stablecoin SDK instance.
// Shared across all services and routes.

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import * as fs from "fs";
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
export async function initSolana(
  config: AppConfig,
  logger: pino.Logger
): Promise<SolanaContext> {
  logger.info({ rpcUrl: config.solanaRpcUrl }, "Connecting to Solana");

  const connection = new Connection(config.solanaRpcUrl, {
    commitment: "confirmed",
    wsEndpoint: config.solanaWsUrl,
  });

  // Verify connection
  const version = await connection.getVersion();
  logger.info({ version: version["solana-core"] }, "Solana node connected");

  // Load authority keypair if provided (for write operations)
  let authority: Keypair | null = null;
  if (config.authorityKeypairPath && fs.existsSync(config.authorityKeypairPath)) {
    const raw = JSON.parse(fs.readFileSync(config.authorityKeypairPath, "utf-8"));
    authority = Keypair.fromSecretKey(Uint8Array.from(raw));
    logger.info(
      { authority: authority.publicKey.toBase58() },
      "Authority keypair loaded"
    );
  } else {
    logger.warn("No authority keypair configured — write operations disabled");
  }

  const configPda = new PublicKey(config.stablecoinConfig);

  // Load stablecoin from chain
  const stablecoin = await SolanaStablecoin.load(
    connection,
    configPda,
    authority ?? undefined
  );

  const stableConfig = await stablecoin.getConfig();
  logger.info(
    {
      name: stableConfig.name,
      symbol: stableConfig.symbol,
      mint: stableConfig.mint.toBase58(),
      preset: stablecoin.isCompliant ? "SSS-2" : "SSS-1",
      paused: stableConfig.isPaused,
    },
    "Stablecoin loaded"
  );

  return { connection, stablecoin, authority, configPda };
}
