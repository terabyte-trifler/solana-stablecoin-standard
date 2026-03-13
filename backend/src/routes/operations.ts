// backend/src/routes/operations.ts

import { Router, Request, Response } from "express";
import { MintBurnService } from "../services/mint-burn";
import { EventIndexer } from "../services/indexer";
import { SolanaContext } from "../utils/solana";
import BN from "bn.js";
import pino from "pino";

export function operationRoutes(
  mintBurnService: MintBurnService,
  indexer: EventIndexer,
  solanaCtx: SolanaContext,
  logger: pino.Logger
): Router {
  const router = Router();

  /**
   * POST /mint
   * Body: { recipient: string, amount: string, idempotencyKey?: string }
   *
   * Mints tokens to the recipient. Amount in smallest units.
   * Returns tx signature on success.
   */
  router.post("/mint", async (req: Request, res: Response) => {
    const { recipient, amount, idempotencyKey } = req.body;

    if (!recipient || !amount) {
      return res.status(400).json({ error: "Missing required fields: recipient, amount" });
    }

    const result = await mintBurnService.mint({
      recipient,
      amount,
      idempotencyKey,
    });

    res.status(result.status === "success" ? 200 : 400).json(result);
  });

  /**
   * POST /burn
   * Body: { amount: string, idempotencyKey?: string }
   *
   * Burns tokens from the backend's authority wallet.
   */
  router.post("/burn", async (req: Request, res: Response) => {
    const { amount, idempotencyKey } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Missing required field: amount" });
    }

    const result = await mintBurnService.burn({ amount, idempotencyKey });
    res.status(result.status === "success" ? 200 : 400).json(result);
  });

  /**
   * GET /supply
   * Returns current total supply.
   */
  router.get("/supply", async (_req: Request, res: Response) => {
    try {
      const supply = await mintBurnService.getSupply();
      res.json(supply);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /status
   * Returns full stablecoin configuration and state.
   */
  router.get("/status", async (_req: Request, res: Response) => {
    try {
      const config = await solanaCtx.stablecoin.getConfig();
      const roles = await solanaCtx.stablecoin.getRoles();

      res.json({
        name: config.name,
        symbol: config.symbol,
        decimals: config.decimals,
        mint: config.mint.toBase58(),
        totalSupply: config.totalSupply.toString(),
        isPaused: config.isPaused,
        preset: solanaCtx.stablecoin.isCompliant ? "SSS-2" : "SSS-1",
        features: {
          permanentDelegate: config.enablePermanentDelegate,
          transferHook: config.enableTransferHook,
          defaultAccountFrozen: config.defaultAccountFrozen,
        },
        authority: {
          master: config.masterAuthority.toBase58(),
          pendingTransfer: config.pendingMasterAuthority?.toBase58() ?? null,
        },
        roles: {
          minters: roles.minters.map((m) => ({
            address: m.address.toBase58(),
            quota: m.quota.toString(),
            minted: m.minted.toString(),
            lastResetEpoch: m.lastResetEpoch.toString(),
          })),
          burners: roles.burners.map((b) => b.toBase58()),
          pausers: roles.pausers.map((p) => p.toBase58()),
          blacklisters: roles.blacklisters.map((b) => b.toBase58()),
          seizers: roles.seizers.map((s) => s.toBase58()),
        },
        indexerStats: indexer.getStats(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /holders?minBalance=1000000
   * Returns all token holders, optionally filtered by minimum balance.
   */
  router.get("/holders", async (req: Request, res: Response) => {
    try {
      const minBalance = req.query.minBalance
        ? new BN(req.query.minBalance as string)
        : undefined;

      const holders = await solanaCtx.stablecoin.getHolders(minBalance);

      res.json({
        count: holders.length,
        holders: holders.map((h) => ({
          owner: h.owner.toBase58(),
          tokenAccount: h.tokenAccount.toBase58(),
          balance: h.balance.toString(),
          isFrozen: h.isFrozen,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /events?name=TokensMinted&limit=50&offset=0
   * Returns indexed events from the in-memory store.
   */
  router.get("/events", (req: Request, res: Response) => {
    const events = indexer.getEvents({
      eventName: req.query.name as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    });

    res.json({
      count: events.length,
      stats: indexer.getStats(),
      events,
    });
  });

  return router;
}
