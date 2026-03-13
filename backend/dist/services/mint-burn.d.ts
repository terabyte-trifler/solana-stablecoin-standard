import pino from "pino";
import { WebhookService } from "./webhook";
import { SolanaContext } from "../utils/solana";
export interface MintRequest {
    recipient: string;
    amount: string;
    idempotencyKey?: string;
}
export interface BurnRequest {
    amount: string;
    idempotencyKey?: string;
}
export interface OperationResult {
    status: "success" | "error";
    signature?: string;
    error?: string;
    amount: string;
    timestamp: string;
}
export declare class MintBurnService {
    private stablecoin;
    private authority;
    private webhook;
    private logger;
    private decimals;
    private cache;
    constructor(solanaCtx: SolanaContext, webhook: WebhookService, logger: pino.Logger);
    initialize(): Promise<void>;
    mint(req: MintRequest): Promise<OperationResult>;
    burn(req: BurnRequest): Promise<OperationResult>;
    /** Get current total supply from chain. */
    getSupply(): Promise<{
        totalSupply: string;
        decimals: number;
    }>;
    private _error;
}
