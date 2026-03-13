import { Router } from "express";
import { SolanaContext } from "../utils/solana";
import { EventIndexer } from "../services/indexer";
import pino from "pino";
export declare function healthRoutes(solanaCtx: SolanaContext, indexer: EventIndexer, logger: pino.Logger): Router;
