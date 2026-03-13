"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function parseIntEnv(name, fallback) {
    const value = process.env[name];
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        throw new Error(`Invalid integer for ${name}: ${value}`);
    }
    return parsed;
}
function loadConfig() {
    const stablecoinConfig = process.env.STABLECOIN_CONFIG;
    if (!stablecoinConfig) {
        throw new Error("Missing required env var: STABLECOIN_CONFIG");
    }
    const rawCluster = (process.env.SOLANA_CLUSTER ?? "localnet").toLowerCase();
    const solanaCluster = rawCluster === "localnet" || rawCluster === "devnet" || rawCluster === "mainnet"
        ? rawCluster
        : "localnet";
    const defaultRpcUrl = solanaCluster === "localnet"
        ? "http://127.0.0.1:8899"
        : solanaCluster === "devnet"
            ? "https://api.devnet.solana.com"
            : "https://api.mainnet-beta.solana.com";
    const defaultWsUrl = solanaCluster === "localnet"
        ? "ws://127.0.0.1:8900"
        : undefined;
    return {
        host: process.env.HOST ?? "0.0.0.0",
        port: parseIntEnv("PORT", 8080),
        logLevel: process.env.LOG_LEVEL ?? "info",
        solanaCluster,
        solanaRpcUrl: process.env.SOLANA_RPC_URL ?? defaultRpcUrl,
        solanaWsUrl: process.env.SOLANA_WS_URL || defaultWsUrl,
        stablecoinConfig,
        authorityKeypairPath: process.env.AUTHORITY_KEYPAIR_PATH || undefined,
        apiKey: process.env.API_KEY ?? null,
        writeRateLimitWindowMs: parseIntEnv("WRITE_RATE_LIMIT_WINDOW_MS", 60000),
        writeRateLimitMax: parseIntEnv("WRITE_RATE_LIMIT_MAX", 60),
        indexerStatePath: process.env.INDEXER_STATE_PATH ?? "./data/indexer-state.json",
        webhookUrl: process.env.WEBHOOK_URL ?? null,
        webhookSecret: process.env.WEBHOOK_SECRET ?? null,
        webhookMaxRetries: parseIntEnv("WEBHOOK_MAX_RETRIES", 3),
        sanctionsApiUrl: process.env.SANCTIONS_API_URL ?? null,
        sanctionsApiKey: process.env.SANCTIONS_API_KEY ?? null,
    };
}
