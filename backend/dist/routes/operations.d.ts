import { Router } from "express";
import { MintBurnService } from "../services/mint-burn";
import { EventIndexer } from "../services/indexer";
import { SolanaContext } from "../utils/solana";
import pino from "pino";
export declare function operationRoutes(mintBurnService: MintBurnService, indexer: EventIndexer, solanaCtx: SolanaContext, logger: pino.Logger): Router;
