// frontend/src/hooks/useStablecoin.ts

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
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

export interface StablecoinHookState extends StablecoinState {
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  executeTx: (fn: () => Promise<string>) => Promise<string>;
}

export function useStablecoin(configPda: string | null): StablecoinHookState {
  const { connection } = useConnection();
  const wallet = useWallet();
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

  const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            `${label} timed out. Check RPC endpoint: ${connection.rpcEndpoint}`
          )
        );
      }, 15000);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  // ── Load stablecoin from chain ─────────────────────────────
  const load = useCallback(async () => {
    if (!configPda) return;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const pda = new PublicKey(configPda);
      const stable = await withTimeout(
        wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions
          ? SolanaStablecoin.loadWithWallet(connection, pda, {
              publicKey: wallet.publicKey,
              signTransaction: wallet.signTransaction as any,
              signAllTransactions: wallet.signAllTransactions as any,
            })
          : SolanaStablecoin.load(connection, pda),
        "Loading stablecoin"
      );
      const config = await withTimeout(stable.getConfig(), "Fetching stablecoin config");

      const rolesResult = await withTimeout(
        stable.getRoles().then(
          (value) => ({ ok: true as const, value }),
          (error) => ({ ok: false as const, error }),
        ),
        "Fetching role manager"
      );

      const holdersResult = await withTimeout(
        stable.getHolders().then(
          (value) => ({ ok: true as const, value }),
          (error) => ({ ok: false as const, error }),
        ),
        "Fetching holders"
      );

      const roles = rolesResult.ok ? rolesResult.value : null;
      const holders = holdersResult.ok ? holdersResult.value : [];

      let blacklisted: BlacklistEntryAccount[] = [];
      if (stable.isCompliant) {
        try {
          blacklisted = await stable.compliance.getAllBlacklisted();
        } catch {}
      }

      const warningMessages = [
        !rolesResult.ok ? `roles: ${rolesResult.error?.message ?? String(rolesResult.error)}` : null,
        !holdersResult.ok ? `holders: ${holdersResult.error?.message ?? String(holdersResult.error)}` : null,
      ].filter(Boolean);

      setState({
        stablecoin: stable,
        config,
        roles,
        holders,
        blacklisted,
        loading: false,
        error: warningMessages.length > 0 ? `Loaded with partial data (${warningMessages.join("; ")})` : null,
        txPending: false,
        lastTx: null,
      });
    } catch (err: any) {
      const reason = err?.message ?? String(err);
      setState((s) => ({ ...s, loading: false, error: `${reason} (RPC: ${connection.rpcEndpoint})` }));
    }
  }, [configPda, connection, wallet.publicKey, wallet.signAllTransactions, wallet.signTransaction]);

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
