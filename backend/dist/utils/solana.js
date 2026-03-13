"use strict";
// backend/src/utils/solana.ts
//
// Initializes the Solana connection and loads the stablecoin SDK instance.
// Shared across all services and routes.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSolana = initSolana;
const web3_js_1 = require("@solana/web3.js");
const sss_token_1 = require("@stbr/sss-token");
const fs = __importStar(require("fs"));
/**
 * Initialize the Solana connection and load the stablecoin instance.
 * Called once at server startup.
 */
async function initSolana(config, logger) {
    logger.info({ rpcUrl: config.solanaRpcUrl }, "Connecting to Solana");
    const connection = new web3_js_1.Connection(config.solanaRpcUrl, {
        commitment: "confirmed",
        wsEndpoint: config.solanaWsUrl,
    });
    // Verify connection
    const version = await connection.getVersion();
    logger.info({ version: version["solana-core"] }, "Solana node connected");
    // Load authority keypair if provided (for write operations)
    let authority = null;
    if (config.authorityKeypairPath && fs.existsSync(config.authorityKeypairPath)) {
        const raw = JSON.parse(fs.readFileSync(config.authorityKeypairPath, "utf-8"));
        authority = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(raw));
        logger.info({ authority: authority.publicKey.toBase58() }, "Authority keypair loaded");
    }
    else {
        logger.warn("No authority keypair configured — write operations disabled");
    }
    const configPda = new web3_js_1.PublicKey(config.stablecoinConfig);
    // Load stablecoin from chain
    const stablecoin = await sss_token_1.SolanaStablecoin.load(connection, configPda, authority ?? undefined);
    const stableConfig = await stablecoin.getConfig();
    logger.info({
        name: stableConfig.name,
        symbol: stableConfig.symbol,
        mint: stableConfig.mint.toBase58(),
        preset: stablecoin.isCompliant ? "SSS-2" : "SSS-1",
        paused: stableConfig.isPaused,
    }, "Stablecoin loaded");
    return { connection, stablecoin, authority, configPda };
}
