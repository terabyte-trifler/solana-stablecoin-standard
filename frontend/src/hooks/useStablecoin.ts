// frontend/src/hooks/useStablecoin.ts

import { useState, useEffect, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  SolanaStablecoin,
  StablecoinConfigAccount,
  RoleManagerAccount,
  HolderInfo,
  BlacklistEntryAccount,
} from "@stbr/sss-token";

export interface StablecoinState {
  stablecoin: SolanaStablecoin | null;
  config: StablecoinConfigAccount | null;
  roles: RoleManagerAccount | null;
  holders: HolderInfo[];
  blacklisted: BlacklistEntryAccount[];
  loading: boolean;
  error: string | null;
  txPending: boolean;
  lastTx: string | null;
}

export function useStablecoin(configPda: string | null) {
  const { connection } = useConnection();
  const [state, setState] = useState<StablecoinState>({
    stablecoin: null,
    config: null,
    roles: null,
    holders: [],
    blacklisted: [],
    loading: false,
    error: null,
    txPending: false,
    lastTx: null,
  });

  // ── Load stablecoin from chain ─────────────────────────────
  const load = useCallback(async () => {
    if (!configPda) return;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const pda = new PublicKey(configPda);
      const stable = await SolanaStablecoin.load(connection, pda);
      const [config, roles, holders] = await Promise.all([
        stable.getConfig(),
        stable.getRoles(),
        stable.getHolders(),
      ]);

      let blacklisted: BlacklistEntryAccount[] = [];
      if (stable.isCompliant) {
        try {
          blacklisted = await stable.compliance.getAllBlacklisted();
        } catch {}
      }

      setState({
        stablecoin: stable,
        config,
        roles,
        holders,
        blacklisted,
        loading: false,
        error: null,
        txPending: false,
        lastTx: null,
      });
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [configPda, connection]);

  useEffect(() => { load(); }, [load]);

  // ── Refresh helper ─────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!state.stablecoin) return;
    try {
      const [config, roles, holders] = await Promise.all([
        state.stablecoin.getConfig(),
        state.stablecoin.getRoles(),
        state.stablecoin.getHolders(),
      ]);

      let blacklisted: BlacklistEntryAccount[] = [];
      if (state.stablecoin.isCompliant) {
        try { blacklisted = await state.stablecoin.compliance.getAllBlacklisted(); } catch {}
      }

      setState((s) => ({ ...s, config, roles, holders, blacklisted }));
    } catch {}
  }, [state.stablecoin]);

  // ── TX wrapper ─────────────────────────────────────────────
  const executeTx = useCallback(
    async (fn: () => Promise<string>) => {
      setState((s) => ({ ...s, txPending: true, error: null, lastTx: null }));
      try {
        const sig = await fn();
        setState((s) => ({ ...s, txPending: false, lastTx: sig }));
        // Refresh after a short delay to let the chain confirm
        setTimeout(refresh, 2000);
        return sig;
      } catch (err: any) {
        setState((s) => ({ ...s, txPending: false, error: err.message }));
        throw err;
      }
    },
    [refresh]
  );

  return { ...state, load, refresh, executeTx };
}
