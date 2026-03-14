// frontend/src/components/ConnectPanel.tsx

import React, { useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, resolveProgramIds } from "@stbr/sss-token";

interface Props {
  onConnect: (configPda: string) => void;
}

export const ConnectPanel: React.FC<Props> = ({ onConnect }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [pdaInput, setPdaInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<"load" | "create">("load");
  const [preset, setPreset] = useState<"SSS_1" | "SSS_2">("SSS_1");
  const [name, setName] = useState("My Stablecoin");
  const [symbol, setSymbol] = useState("MYUSD");
  const [programReady, setProgramReady] = useState<boolean | null>(null);
  const [programStatus, setProgramStatus] = useState<string>("Checking deployed programs...");
  const createInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkPrograms() {
      const ids = resolveProgramIds(connection.rpcEndpoint);
      try {
        const [tokenProgram, hookProgram] = await Promise.all([
          connection.getAccountInfo(ids.sssTokenProgramId),
          connection.getAccountInfo(ids.sssTransferHookProgramId),
        ]);

        if (cancelled) return;

        if (!tokenProgram) {
          setProgramReady(false);
          setProgramStatus(
            `Main program ${ids.sssTokenProgramId.toBase58()} is not deployed on this RPC.`
          );
          return;
        }

        if (!hookProgram) {
          setProgramReady(false);
          setProgramStatus(
            `Transfer-hook program ${ids.sssTransferHookProgramId.toBase58()} is not deployed on this RPC.`
          );
          return;
        }

        setProgramReady(true);
        setProgramStatus(
          `Programs ready on ${connection.rpcEndpoint.includes("127.0.0.1") ? "localnet" : "devnet"}.`
        );
      } catch (err: any) {
        if (cancelled) return;
        setProgramReady(false);
        setProgramStatus(err?.message ?? "Unable to verify program deployment.");
      }
    }

    checkPrograms();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  const handleLoad = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pdaInput.trim()) return setError("Enter a config PDA address");
    try {
      new PublicKey(pdaInput.trim());
      onConnect(pdaInput.trim());
    } catch {
      setError("Invalid public key");
    }
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (createInFlightRef.current || creating) {
      return;
    }
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      setError("Connect wallet with signing support first");
      return;
    }
    if (programReady === false) {
      setError(programStatus);
      return;
    }
    createInFlightRef.current = true;
    setCreating(true);
    setError(null);
    try {
      // Localnet convenience: auto-fund connected wallet if balance is too low.
      if (connection.rpcEndpoint.includes("127.0.0.1") || connection.rpcEndpoint.includes("localhost")) {
        const bal = await connection.getBalance(wallet.publicKey, "confirmed");
        if (bal < 50_000_000) {
          const sig = await connection.requestAirdrop(wallet.publicKey, 2_000_000_000);
          await connection.confirmTransaction(sig, "confirmed");
        }
      }

      const stable = await SolanaStablecoin.createWithWallet(connection, {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction as any,
        signAllTransactions: wallet.signAllTransactions as any,
      }, {
        preset,
        name,
        symbol,
        decimals: 6,
      });

      // Give fresh accounts a moment to become consistently readable on the RPC,
      // especially right after wallet-signed create flows.
      let ready = false;
      let lastReason = "";
      for (let i = 0; i < 6; i++) {
        try {
          const loaded = await SolanaStablecoin.loadWithWallet(connection, stable.configPda, {
            publicKey: wallet.publicKey,
            signTransaction: wallet.signTransaction as any,
            signAllTransactions: wallet.signAllTransactions as any,
          });
          await loaded.getConfig();
          await loaded.getRoles();
          ready = true;
          break;
        } catch (err: any) {
          lastReason = err?.message ?? String(err);
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }

      if (!ready && lastReason) {
        setError(`Stablecoin created, but post-create load is still warming up: ${lastReason}`);
      }

      onConnect(stable.configPda.toBase58());
    } catch (err: any) {
      const reason =
        err?.logs?.join("\n") ||
        err?.message ||
        "Failed to create stablecoin";
      setError(reason);
    } finally {
      createInFlightRef.current = false;
      setCreating(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Load Stablecoin Config</h2>
      <p style={styles.subtle}>Paste your `StablecoinConfig` PDA from CLI `sss-token status` output.</p>
      <p style={styles.rpc}>
        RPC: <code>{connection.rpcEndpoint}</code>
      </p>
      {programReady === false && (
        <div style={styles.banner}>
          <strong>Programs not deployed on this cluster.</strong>
          <span style={styles.bannerText}>
            Switch to Localnet or deploy the stablecoin programs to this RPC before creating or loading from the frontend.
          </span>
        </div>
      )}
      <p style={programReady === false ? styles.error : styles.status}>
        {programStatus}
      </p>

      <div style={styles.toggle}>
        <button
          style={mode === "load" ? styles.toggleActive : styles.toggleBtn}
          onClick={() => !creating && setMode("load")}
          disabled={creating}
        >
          Load Existing
        </button>
        <button
          style={mode === "create" ? styles.toggleActive : styles.toggleBtn}
          onClick={() => !creating && setMode("create")}
          disabled={creating}
        >
          Create New
        </button>
      </div>

      {mode === "load" ? (
        <form style={styles.form} onSubmit={handleLoad}>
          <label style={styles.label}>StablecoinConfig PDA Address</label>
          <input
            style={styles.input}
            value={pdaInput}
            onChange={(e) => setPdaInput(e.target.value)}
            placeholder="Enter the config PDA from sss-token status..."
          />
          <button style={styles.btn} type="submit">Load Stablecoin</button>
        </form>
      ) : (
        <form style={styles.form} onSubmit={handleCreate}>
          <label style={styles.label}>Preset</label>
          <div style={styles.presetRow}>
            <button
              type="button"
              style={preset === "SSS_1" ? styles.presetActive : styles.presetBtn}
              onClick={() => !creating && setPreset("SSS_1")}
              disabled={creating}
            >
              <strong>SSS-1</strong>
              <span style={styles.presetMeta}>Minimal</span>
            </button>
            <button
              type="button"
              style={preset === "SSS_2" ? styles.presetActive : styles.presetBtn}
              onClick={() => !creating && setPreset("SSS_2")}
              disabled={creating}
            >
              <strong>SSS-2</strong>
              <span style={styles.presetMeta}>Compliant</span>
            </button>
          </div>
          <label style={styles.label}>Token Name</label>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} disabled={creating} />
          <label style={styles.label}>Token Symbol</label>
          <input style={styles.input} value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={creating} />
          <button style={styles.btn} type="submit" disabled={creating}>
            {creating ? "Awaiting wallet confirmation..." : "Create Stablecoin"}
          </button>
        </form>
      )}

      {error && <p style={styles.error}>{error}</p>}

      {!wallet.publicKey && (
        <p style={styles.error}>Connect wallet to load and inspect state.</p>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 560, margin: "56px auto", padding: 32, background: "var(--card)", borderRadius: 18, border: "1px solid var(--line)" },
  title: { color: "#e2e8f0", marginBottom: 24, textAlign: "center" },
  subtle: { color: "var(--muted)", marginBottom: 16, textAlign: "center", fontSize: 13 },
  rpc: { color: "#9bc5e8", marginBottom: 14, textAlign: "center", fontSize: 12 },
  banner: {
    marginBottom: 14,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #7f1d1d",
    background: "linear-gradient(180deg, rgba(127,29,29,0.22), rgba(68,10,10,0.26))",
    color: "#fecaca",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
  },
  bannerText: { color: "#fca5a5" },
  status: { color: "#86efac", marginBottom: 14, textAlign: "center", fontSize: 12 },
  toggle: { display: "flex", gap: 6, marginBottom: 16, background: "#0d2034", padding: 6, borderRadius: 10, border: "1px solid #2d5272" },
  toggleBtn: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: "#9bc5e8", fontWeight: 600 },
  toggleActive: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #2d5272", cursor: "pointer", background: "#173555", color: "#d5ecff", fontWeight: 700 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { color: "#94a3b8", fontSize: 13, fontWeight: 500 },
  input: { padding: "10px 14px", background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none" },
  btn: { padding: "12px 24px", background: "linear-gradient(135deg, #14c8b0, #2fd5ff)", border: "none", borderRadius: 10, color: "#062036", cursor: "pointer", fontWeight: 700, fontSize: 15, marginTop: 8 },
  presetRow: { display: "flex", gap: 10 },
  presetBtn: { flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #2d5272", background: "#0d2034", color: "#cde7ff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  presetActive: { flex: 1, padding: "12px", borderRadius: 10, border: "2px solid #2fd5ff", background: "#0d2034", color: "#e8f8ff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  presetMeta: { fontSize: 12, color: "#9bc5e8" },
  error: { color: "#ef4444", marginTop: 12, fontSize: 13 },
};
