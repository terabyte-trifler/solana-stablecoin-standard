export interface AppConfig {
    host: string;
    port: number;
    logLevel: string;
    solanaCluster: "localnet" | "devnet" | "mainnet";
    solanaRpcUrl: string;
    solanaWsUrl?: string;
    stablecoinConfig: string;
    authorityKeypairPath?: string;
    apiKey: string | null;
    writeRateLimitWindowMs: number;
    writeRateLimitMax: number;
    indexerStatePath: string;
    webhookUrl: string | null;
    webhookSecret: string | null;
    webhookMaxRetries: number;
    sanctionsApiUrl: string | null;
    sanctionsApiKey: string | null;
}
export declare function loadConfig(): AppConfig;
