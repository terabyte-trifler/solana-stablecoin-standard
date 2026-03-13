// frontend/src/components/MintBurnPanel.tsx

import React, { useState } from "react";
import { StablecoinState } from "../hooks/useStablecoin";
import BN from "bn.js";

interface Props {
  state: StablecoinState;
}

export const MintBurnPanel: React.FC<Props> = ({ state }) => {
  const { config, stablecoin } = state;

  // Mint form
  const [mintRecipient, setMintRecipient] = useState("");
  const [mintAmount, setMintAmount] = useState("");

  // Burn form
  const [burnAmount, setBurnAmount] = useState("");

  if (!config || !stablecoin) return null;
  const decimals = config.decimals;

  const writeDisabledReason =
    "Write actions are intentionally disabled in this frontend until SDK wallet-adapter signer support lands. Use CLI/backend for mint and burn.";

  return (
    <div style={styles.grid}>
      {/* Mint */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>💰 Mint Tokens</h3>
        <p style={styles.desc}>
          Mint new {config.symbol} tokens to a recipient address.
          {config.isPaused && <span style={styles.warn}> Operations are paused.</span>}
        </p>

        <label style={styles.label}>Recipient Wallet</label>
        <input
          style={styles.input}
          value={mintRecipient}
          onChange={(e) => setMintRecipient(e.target.value)}
          placeholder="Recipient pubkey..."
        />

        <label style={styles.label}>Amount ({config.symbol})</label>
        <input
          style={styles.input}
          value={mintAmount}
          onChange={(e) => setMintAmount(e.target.value)}
          placeholder={`e.g., 1000 or 1000.50`}
          type="text"
        />

        <button
          style={config.isPaused ? styles.btnDisabled : styles.btnMint}
          onClick={() => undefined}
          disabled
          title={writeDisabledReason}
        >
          Mint via CLI / backend
        </button>
      </div>

      {/* Burn */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>🔥 Burn Tokens</h3>
        <p style={styles.desc}>
          Burn {config.symbol} from your own token account.
          {config.isPaused && <span style={styles.warn}> Operations are paused.</span>}
        </p>

        <label style={styles.label}>Amount ({config.symbol})</label>
        <input
          style={styles.input}
          value={burnAmount}
          onChange={(e) => setBurnAmount(e.target.value)}
          placeholder={`Amount to burn...`}
          type="text"
        />

        <button
          style={config.isPaused ? styles.btnDisabled : styles.btnBurn}
          onClick={() => undefined}
          disabled
          title={writeDisabledReason}
        >
          Burn via CLI / backend
        </button>
      </div>

      {/* Minters info */}
      <div style={{ ...styles.panel, gridColumn: "1 / -1" }}>
        <h3 style={styles.panelTitle}>Registered Minters</h3>
        {state.roles?.minters.length === 0 ? (
          <p style={styles.desc}>No minters registered. The master authority can always mint.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Address</th>
                <th style={styles.th}>Quota/Epoch</th>
                <th style={styles.th}>Minted This Epoch</th>
                <th style={styles.th}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {state.roles?.minters.map((m, i) => {
                const quota = m.quota.isZero() ? "Unlimited" : m.quota.toString();
                const remaining = m.quota.isZero() ? "∞" : m.quota.sub(BN.min(m.minted, m.quota)).toString();
                return (
                  <tr key={i}>
                    <td style={styles.td}>{shortKey(m.address)}</td>
                    <td style={styles.td}>{quota}</td>
                    <td style={styles.td}>{m.minted.toString()}</td>
                    <td style={{ ...styles.td, color: "#22c55e" }}>{remaining}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div style={styles.notice}>
        <strong>Read-only write panel:</strong> {writeDisabledReason}
      </div>
    </div>
  );
};

function shortKey(key: any): string {
  const s = key?.toBase58?.() ?? String(key);
  return s.slice(0, 8) + "..." + s.slice(-4);
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  panel: { background: "#1e293b", borderRadius: 12, padding: 24 },
  panelTitle: { color: "#e2e8f0", marginBottom: 8 },
  desc: { color: "#94a3b8", fontSize: 13, marginBottom: 16, lineHeight: 1.5 },
  warn: { color: "#eab308", fontWeight: 600 },
  label: { color: "#94a3b8", fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" },
  input: { width: "100%", padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none", marginBottom: 12 },
  btnMint: { width: "100%", padding: "12px", background: "#059669", border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontWeight: 600, fontSize: 15 },
  btnBurn: { width: "100%", padding: "12px", background: "#dc2626", border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontWeight: 600, fontSize: 15 },
  btnDisabled: { width: "100%", padding: "12px", background: "#334155", border: "none", borderRadius: 8, color: "#64748b", cursor: "not-allowed", fontWeight: 600, fontSize: 15 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "8px 12px", color: "#64748b", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #334155" },
  td: { padding: "8px 12px", fontSize: 13, color: "#e2e8f0", fontFamily: "monospace", borderBottom: "1px solid #1e293b" },
  notice: { gridColumn: "1 / -1", background: "#0f2439", border: "1px solid #2a4f70", padding: "10px 12px", borderRadius: 10, color: "#9bc5e8", fontSize: 13 },
};
