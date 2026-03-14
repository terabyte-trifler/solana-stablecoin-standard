// frontend/src/components/BlacklistPanel.tsx

import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { StablecoinHookState } from "../hooks/useStablecoin";
import BN from "bn.js";

interface Props {
  state: StablecoinHookState;
}

function shortKey(key: any): string {
  const s = key?.toBase58?.() ?? String(key);
  return s.slice(0, 8) + "..." + s.slice(-4);
}

function fmtTimestamp(ts: BN): string {
  const num = typeof ts === "number" ? ts : ts.toNumber();
  if (num === 0) return "Unknown";
  return new Date(num * 1000).toLocaleString();
}

export const BlacklistPanel: React.FC<Props> = ({ state }) => {
  const { config, stablecoin, blacklisted, executeTx, txPending } = state;

  // Add to blacklist form
  const [addAddress, setAddAddress] = useState("");
  const [addReason, setAddReason] = useState("");

  // Remove from blacklist
  const [removeAddress, setRemoveAddress] = useState("");

  // Check address
  const [checkAddress, setCheckAddress] = useState("");
  const [checkResult, setCheckResult] = useState<{ checked: boolean; isBlacklisted: boolean; reason?: string } | null>(null);

  // Seize form
  const [seizeFrom, setSeizeFrom] = useState("");
  const [seizeTo, setSeizeTo] = useState("");
  const [seizeAmount, setSeizeAmount] = useState("");

  if (!config || !stablecoin) return null;

  const isSSS2 = stablecoin.isCompliant;

  if (!isSSS2) {
    return (
      <div style={styles.container}>
        <div style={styles.disabled}>
          <h3 style={{ color: "#94a3b8" }}>Compliance Features Unavailable</h3>
          <p style={{ color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>
            This stablecoin was created with SSS-1 (Minimal) preset.
            Blacklist management, transfer hook enforcement, and token seizure
            require SSS-2 (Compliant) preset. Create a new stablecoin with
            SSS-2 to enable compliance features.
          </p>
        </div>
      </div>
    );
  }

  const parseAmount = (str: string): BN => {
    if (!str.trim()) return new BN(0);
    if (str.includes(".")) {
      const [whole, frac] = str.split(".");
      const padded = (frac || "").padEnd(config.decimals, "0").slice(0, config.decimals);
      return new BN(`${whole || "0"}${padded}`);
    }
    return new BN(str);
  };

  const handleAdd = async () => {
    if (!addAddress || !addReason) return;
    await executeTx(async () =>
      stablecoin.compliance.blacklistAdd(
        new PublicKey(addAddress),
        addReason,
      ),
    );
    setAddAddress("");
    setAddReason("");
  };

  const handleRemove = async () => {
    if (!removeAddress) return;
    await executeTx(async () =>
      stablecoin.compliance.blacklistRemove(new PublicKey(removeAddress)),
    );
    setRemoveAddress("");
  };

  const handleSeize = async () => {
    if (!seizeFrom || !seizeTo || !seizeAmount) return;
    await executeTx(async () =>
      stablecoin.compliance.seize({
        from: new PublicKey(seizeFrom),
        to: new PublicKey(seizeTo),
        amount: parseAmount(seizeAmount),
      }),
    );
    setSeizeAmount("");
  };

  const handleCheck = async () => {
    if (!checkAddress) return;
    try {
      const result = await stablecoin.compliance.isBlacklisted(new PublicKey(checkAddress));
      let reason: string | undefined;
      if (result) {
        const entry = await stablecoin.compliance.getBlacklistEntry(new PublicKey(checkAddress));
        reason = entry?.reason;
      }
      setCheckResult({ checked: true, isBlacklisted: result, reason });
    } catch (err: any) {
      setCheckResult({ checked: true, isBlacklisted: false, reason: err.message });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {/* Add to blacklist */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>🚫 Blacklist Address</h3>
          <p style={styles.desc}>
            Add a wallet address to the on-chain blacklist.
            The transfer hook will block all transfers involving this address.
          </p>

          <label style={styles.label}>Wallet Address</label>
          <input
            style={styles.input}
            value={addAddress}
            onChange={(e) => setAddAddress(e.target.value)}
            placeholder="Wallet pubkey to blacklist..."
          />

          <label style={styles.label}>Reason</label>
          <input
            style={styles.input}
            value={addReason}
            onChange={(e) => setAddReason(e.target.value)}
            placeholder="e.g., OFAC SDN match — list update 2025-03"
          />

          <button
            style={styles.btnDanger}
            onClick={handleAdd}
            disabled={txPending}
          >
            {txPending ? "Processing..." : "Add to Blacklist"}
          </button>
        </div>

        {/* Check address */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>🔍 Check Address</h3>
          <p style={styles.desc}>Check if a wallet address is currently blacklisted.</p>

          <label style={styles.label}>Wallet Address</label>
          <input
            style={styles.input}
            value={checkAddress}
            onChange={(e) => { setCheckAddress(e.target.value); setCheckResult(null); }}
            placeholder="Wallet pubkey to check..."
          />

          <button style={styles.btnPrimary} onClick={handleCheck}>Check Status</button>

          {checkResult && (
            <div style={{
              ...styles.resultBox,
              borderColor: checkResult.isBlacklisted ? "#ef4444" : "#22c55e",
            }}>
              {checkResult.isBlacklisted ? (
                <>
                  <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 16 }}>🚫 BLACKLISTED</span>
                  {checkResult.reason && (
                    <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Reason: {checkResult.reason}</p>
                  )}
                </>
              ) : (
                <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}>✅ Not Blacklisted</span>
              )}
            </div>
          )}

          {/* Remove section */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #334155" }}>
            <h4 style={{ color: "#e2e8f0", marginBottom: 8 }}>Remove from Blacklist</h4>
            <input
              style={styles.input}
              value={removeAddress}
              onChange={(e) => setRemoveAddress(e.target.value)}
              placeholder="Address to remove..."
            />
            <button
              style={styles.btnSecondary}
              onClick={handleRemove}
              disabled={txPending}
            >
              {txPending ? "Processing..." : "Remove from Blacklist"}
            </button>
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>⚖️ Seize Tokens (SSS-2)</h3>
        <p style={styles.desc}>
          Transfer tokens via permanent delegate from any source token account to a treasury token account.
        </p>
        <label style={styles.label}>Source Token Account</label>
        <input style={styles.input} value={seizeFrom} onChange={(e) => setSeizeFrom(e.target.value)} placeholder="Source token account..." />
        <label style={styles.label}>Destination Token Account</label>
        <input style={styles.input} value={seizeTo} onChange={(e) => setSeizeTo(e.target.value)} placeholder="Treasury token account..." />
        <label style={styles.label}>Amount ({config.symbol})</label>
        <input style={styles.input} value={seizeAmount} onChange={(e) => setSeizeAmount(e.target.value)} placeholder="e.g. 10 or 10.5" />
        <button style={styles.btnDanger} onClick={handleSeize} disabled={txPending}>
          {txPending ? "Processing..." : "Seize Tokens"}
        </button>
      </div>

      {/* Blacklist table */}
      <div style={styles.tablePanel}>
        <h3 style={styles.panelTitle}>
          Blacklisted Addresses ({blacklisted.length})
        </h3>

        {blacklisted.length === 0 ? (
          <p style={{ color: "#64748b", padding: 16 }}>No addresses currently blacklisted.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Address</th>
                <th style={styles.th}>Reason</th>
                <th style={styles.th}>Blacklisted At</th>
                <th style={styles.th}>By</th>
              </tr>
            </thead>
            <tbody>
              {blacklisted.map((entry, i) => (
                <tr key={i}>
                  <td style={{ ...styles.td, fontFamily: "monospace" }}>{shortKey(entry.address)}</td>
                  <td style={styles.td}>
                    {entry.reason.length > 40 ? entry.reason.slice(0, 37) + "..." : entry.reason}
                  </td>
                  <td style={{ ...styles.td, color: "#94a3b8" }}>{fmtTimestamp(entry.blacklistedAt)}</td>
                  <td style={{ ...styles.td, fontFamily: "monospace", color: "#64748b" }}>{shortKey(entry.blacklistedBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 16 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  panel: { background: "#1e293b", borderRadius: 12, padding: 24 },
  panelTitle: { color: "#e2e8f0", marginBottom: 8 },
  desc: { color: "#94a3b8", fontSize: 13, marginBottom: 16, lineHeight: 1.5 },
  label: { color: "#94a3b8", fontSize: 12, fontWeight: 500, marginBottom: 4, display: "block" },
  input: { width: "100%", padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none", marginBottom: 12 },
  btnDanger: { width: "100%", padding: "12px", background: "#dc2626", border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnPrimary: { width: "100%", padding: "12px", background: "#0891b2", border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnSecondary: { width: "100%", padding: "10px", background: "#334155", border: "none", borderRadius: 8, color: "#e2e8f0", cursor: "pointer", fontWeight: 500, fontSize: 13 },
  resultBox: { marginTop: 12, padding: 16, background: "#0f172a", borderRadius: 8, border: "1px solid" },
  tablePanel: { background: "#1e293b", borderRadius: 12, padding: 24 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 16px", color: "#64748b", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #334155", textTransform: "uppercase" },
  td: { padding: "10px 16px", fontSize: 13, color: "#e2e8f0", borderBottom: "1px solid #0f172a" },
  disabled: { background: "#1e293b", borderRadius: 12, padding: 40, textAlign: "center" },
};
