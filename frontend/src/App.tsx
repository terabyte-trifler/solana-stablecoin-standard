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
type UiCluster = "localnet" | "devnet";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message ?? "Unknown runtime error" };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ margin: "40px auto", maxWidth: 760, background: "#3f0f14", border: "1px solid #842029", color: "#ffd5d9", borderRadius: 10, padding: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Frontend Runtime Error</h3>
          <p style={{ marginBottom: 10 }}>
            The UI hit an exception while rendering. Reload after restart; if it persists, capture this message.
          </p>
          <code>{this.state.message}</code>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const activeCluster: UiCluster = connection.rpcEndpoint.includes("127.0.0.1")
    || connection.rpcEndpoint.includes("localhost")
    ? "localnet"
    : "devnet";
  const config = stablecoin.config;
  const stablecoinInstance = stablecoin.stablecoin;
  const canRenderPanels = Boolean(config && stablecoinInstance);
  const activeConfig = config as NonNullable<typeof config>;
  const activeStablecoin = stablecoinInstance as NonNullable<typeof stablecoinInstance>;

  return (
    <ErrorBoundary>
      <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo}>SSS</h1>
          <span style={styles.subtitle}>Solana Stablecoin Standard UI</span>
        </div>
        <div style={styles.headerRight}>
          <ClusterSwitcher activeCluster={activeCluster} />
          <WalletMultiButton />
        </div>
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
      ) : stablecoin.error && !config ? (
        <div style={styles.center}>
          <p style={{ color: "#ef4444" }}>Error: {stablecoin.error}</p>
          <button style={styles.btnSecondary} onClick={() => setConfigPda(null)}>Back</button>
        </div>
      ) : !canRenderPanels ? (
        <div style={styles.center}>
          <p style={{ color: "#94a3b8" }}>Waiting for stablecoin state to load...</p>
          {stablecoin.error && <p style={{ color: "#ef4444" }}>{stablecoin.error}</p>}
          <button style={styles.btnSecondary} onClick={() => setConfigPda(null)}>Back</button>
        </div>
      ) : (
        <>
          {/* Status bar */}
          <div style={styles.statusBar}>
            <StatusBadge
              label={activeConfig.name}
              value={activeConfig.symbol}
              color="#22d3ee"
            />
            <StatusBadge
              label="Supply"
              value={formatAmount(activeConfig.totalSupply, activeConfig.decimals)}
              color="#22c55e"
            />
            <StatusBadge
              label="Preset"
              value={activeStablecoin.isCompliant ? "SSS-2" : "SSS-1"}
              color={activeStablecoin.isCompliant ? "#a855f7" : "#3b82f6"}
            />
            <StatusBadge
              label="Status"
              value={activeConfig.isPaused ? "PAUSED" : "Active"}
              color={activeConfig.isPaused ? "#ef4444" : "#22c55e"}
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
    </ErrorBoundary>
  );
};

// ── Small components ────────────────────────────────────────

const StatusBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={styles.badge}>
    <span style={{ color: "#64748b", fontSize: 11 }}>{label}</span>
    <span style={{ color, fontWeight: 700 }}>{value}</span>
  </div>
);

const ClusterSwitcher: React.FC<{ activeCluster: UiCluster }> = ({ activeCluster }) => {
  const switchCluster = (cluster: UiCluster) => {
    const url = new URL(window.location.href);
    url.searchParams.set("cluster", cluster);
    window.location.href = url.toString();
  };

  return (
    <div style={styles.clusterWrap}>
      <button
        style={activeCluster === "localnet" ? styles.clusterActive : styles.clusterBtn}
        onClick={() => switchCluster("localnet")}
      >
        Localnet
      </button>
      <button
        style={activeCluster === "devnet" ? styles.clusterActive : styles.clusterBtn}
        onClick={() => switchCluster("devnet")}
      >
        Devnet
      </button>
    </div>
  );
};

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
  headerRight: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" },
  logo: { fontSize: 30, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1 },
  subtitle: { color: "var(--muted)", fontSize: 14 },
  clusterWrap: { display: "flex", gap: 6, background: "#0d2034", padding: 6, borderRadius: 999, border: "1px solid #2d5272" },
  clusterBtn: { padding: "8px 14px", background: "transparent", color: "#9bc5e8", border: "none", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: 13 },
  clusterActive: { padding: "8px 14px", background: "#173555", color: "#e6f7ff", border: "1px solid #2fd5ff", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 13 },
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
