// frontend/src/App.tsx

import React, { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useStablecoin } from "./hooks/useStablecoin";
import { ConnectPanel } from "./components/ConnectPanel";
import { Dashboard } from "./components/Dashboard";
import { MintBurnPanel } from "./components/MintBurnPanel";
import { HoldersPanel } from "./components/HoldersPanel";
import { BlacklistPanel } from "./components/BlacklistPanel";

type Tab = "dashboard" | "mint" | "holders" | "compliance";

export const App: React.FC = () => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [configPda, setConfigPda] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const stablecoin = useStablecoin(configPda);
  const explorerCluster = connection.rpcEndpoint.includes("devnet")
    ? "devnet"
    : connection.rpcEndpoint.includes("mainnet")
      ? "mainnet-beta"
      : "custom";

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo}>SSS</h1>
          <span style={styles.subtitle}>Solana Stablecoin Standard UI</span>
        </div>
        <WalletMultiButton />
      </header>

      {/* Connection / Config */}
      {!wallet.connected ? (
        <div style={styles.center}>
          <h2 style={{ color: "var(--muted)" }}>Connect your wallet to get started</h2>
          <WalletMultiButton />
        </div>
      ) : !configPda ? (
        <ConnectPanel onConnect={setConfigPda} />
      ) : stablecoin.loading ? (
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={{ color: "#94a3b8" }}>Loading stablecoin...</p>
        </div>
      ) : stablecoin.error && !stablecoin.config ? (
        <div style={styles.center}>
          <p style={{ color: "#ef4444" }}>Error: {stablecoin.error}</p>
          <button style={styles.btnSecondary} onClick={() => setConfigPda(null)}>Back</button>
        </div>
      ) : (
        <>
          {/* Status bar */}
          <div style={styles.statusBar}>
            <StatusBadge
              label={stablecoin.config!.name}
              value={stablecoin.config!.symbol}
              color="#22d3ee"
            />
            <StatusBadge
              label="Supply"
              value={formatAmount(stablecoin.config!.totalSupply, stablecoin.config!.decimals)}
              color="#22c55e"
            />
            <StatusBadge
              label="Preset"
              value={stablecoin.stablecoin?.isCompliant ? "SSS-2" : "SSS-1"}
              color={stablecoin.stablecoin?.isCompliant ? "#a855f7" : "#3b82f6"}
            />
            <StatusBadge
              label="Status"
              value={stablecoin.config!.isPaused ? "PAUSED" : "Active"}
              color={stablecoin.config!.isPaused ? "#ef4444" : "#22c55e"}
            />
            <StatusBadge label="Holders" value={`${stablecoin.holders.length}`} color="#94a3b8" />
            <StatusBadge label="RPC" value={connection.rpcEndpoint.includes("127.0.0.1") ? "Localnet" : explorerCluster} color="#8db2d6" />
          </div>

          {/* Tabs */}
          <nav style={styles.tabs}>
            {(["dashboard", "mint", "holders", "compliance"] as Tab[]).map((t) => (
              <button
                key={t}
                style={tab === t ? styles.tabActive : styles.tab}
                onClick={() => setTab(t)}
              >
                {t === "dashboard" && "Dashboard"}
                {t === "mint" && "Mint / Burn"}
                {t === "holders" && "Holders"}
                {t === "compliance" && "Compliance"}
              </button>
            ))}
          </nav>

          {/* Toast */}
          {stablecoin.lastTx && (
            <div style={styles.toast}>
              ✅ Transaction confirmed:{" "}
              <a
                href={explorerCluster === "custom"
                  ? `https://explorer.solana.com/tx/${stablecoin.lastTx}`
                  : `https://explorer.solana.com/tx/${stablecoin.lastTx}?cluster=${explorerCluster}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#22d3ee" }}
              >
                {stablecoin.lastTx.slice(0, 20)}...
              </a>
            </div>
          )}
          {stablecoin.error && (
            <div style={{ ...styles.toast, background: "#7f1d1d" }}>
              ❌ {stablecoin.error}
            </div>
          )}

          {/* Active panel */}
          <main style={styles.main}>
            {tab === "dashboard" && <Dashboard state={stablecoin} />}
            {tab === "mint" && <MintBurnPanel state={stablecoin} />}
            {tab === "holders" && <HoldersPanel state={stablecoin} />}
            {tab === "compliance" && <BlacklistPanel state={stablecoin} />}
          </main>
        </>
      )}
    </div>
  );
};

// ── Small components ────────────────────────────────────────

const StatusBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={styles.badge}>
    <span style={{ color: "#64748b", fontSize: 11 }}>{label}</span>
    <span style={{ color, fontWeight: 700 }}>{value}</span>
  </div>
);

function formatAmount(amount: any, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals, str.length - decimals + 2);
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac === "00" ? "" : `.${frac}`);
}

// ── Styles ──────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1240, margin: "0 auto", padding: "0 24px 28px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderBottom: "1px solid var(--line)" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontSize: 30, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1 },
  subtitle: { color: "var(--muted)", fontSize: 14 },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16 },
  statusBar: { display: "flex", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap" },
  badge: { display: "flex", flexDirection: "column", gap: 2, background: "var(--card)", padding: "8px 16px", borderRadius: 10, border: "1px solid var(--line)" },
  tabs: { display: "flex", gap: 8, padding: "16px 0", flexWrap: "wrap" },
  tab: { padding: "8px 20px", background: "transparent", border: "1px solid var(--line)", borderRadius: 10, color: "var(--muted)", cursor: "pointer", fontSize: 14 },
  tabActive: { padding: "8px 20px", background: "#11304b", border: "1px solid var(--cyan)", borderRadius: 10, color: "var(--cyan)", cursor: "pointer", fontSize: 14, fontWeight: 600 },
  main: { padding: "16px 0" },
  toast: { background: "#083d34", border: "1px solid #176155", padding: "10px 16px", borderRadius: 10, margin: "8px 0", fontSize: 13 },
  spinner: { width: 32, height: 32, border: "3px solid #335873", borderTop: "3px solid var(--cyan)", borderRadius: "50%", animation: "spin 1s linear infinite" },
  btnSecondary: { padding: "8px 20px", background: "#233f5d", border: "1px solid #335873", borderRadius: 10, color: "#dbecff", cursor: "pointer" },
};
