// frontend/src/components/HoldersPanel.tsx

import React, { useState, useMemo } from "react";
import { StablecoinState } from "../hooks/useStablecoin";
import BN from "bn.js";

interface Props {
  state: StablecoinState;
}

function fmtBalance(amount: BN, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals, str.length - decimals + 2);
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac === "00" ? "" : `.${frac}`);
}

function shortKey(key: any): string {
  const s = key?.toBase58?.() ?? String(key);
  return s.slice(0, 8) + "..." + s.slice(-4);
}

function fullKey(key: any): string {
  return key?.toBase58?.() ?? String(key);
}

export const HoldersPanel: React.FC<Props> = ({ state }) => {
  const { config, holders } = state;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"balance" | "status">("balance");

  if (!config) return null;
  const decimals = config.decimals;

  const filtered = useMemo(() => {
    let result = [...holders];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (h) =>
          fullKey(h.owner).toLowerCase().includes(q) ||
          fullKey(h.tokenAccount).toLowerCase().includes(q)
      );
    }

    if (sortBy === "balance") {
      result.sort((a, b) => (b.balance.gt(a.balance) ? 1 : -1));
    } else {
      result.sort((a, b) => (a.isFrozen === b.isFrozen ? 0 : a.isFrozen ? -1 : 1));
    }

    return result;
  }, [holders, search, sortBy]);

  const totalFrozen = holders.filter((h) => h.isFrozen).length;

  return (
    <div style={styles.container}>
      {/* Summary bar */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Total Holders</span>
          <span style={styles.summaryValue}>{holders.length}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Frozen Accounts</span>
          <span style={{ ...styles.summaryValue, color: totalFrozen > 0 ? "#ef4444" : "#22c55e" }}>
            {totalFrozen}
          </span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Total Supply</span>
          <span style={styles.summaryValue}>
            {fmtBalance(config.totalSupply, decimals)} {config.symbol}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <input
          style={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by address..."
        />
        <div style={styles.sortBtns}>
          <button
            style={sortBy === "balance" ? styles.sortActive : styles.sortBtn}
            onClick={() => setSortBy("balance")}
          >
            Sort: Balance
          </button>
          <button
            style={sortBy === "status" ? styles.sortActive : styles.sortBtn}
            onClick={() => setSortBy("status")}
          >
            Sort: Status
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Owner</th>
              <th style={styles.th}>Token Account</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Balance</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((h, i) => (
              <tr key={i} style={h.isFrozen ? styles.frozenRow : undefined}>
                <td style={styles.td}>{i + 1}</td>
                <td style={{ ...styles.td, fontFamily: "monospace" }}>{shortKey(h.owner)}</td>
                <td style={{ ...styles.td, fontFamily: "monospace", color: "#64748b" }}>{shortKey(h.tokenAccount)}</td>
                <td style={{ ...styles.td, textAlign: "right", color: "#22c55e", fontWeight: 600 }}>
                  {fmtBalance(h.balance, decimals)}
                </td>
                <td style={styles.td}>
                  {h.isFrozen ? (
                    <span style={styles.frozenBadge}>FROZEN</span>
                  ) : (
                    <span style={styles.activeBadge}>Active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 50 && (
          <p style={{ color: "#64748b", padding: 12, fontSize: 13 }}>
            Showing 50 of {filtered.length} holders
          </p>
        )}
        {filtered.length === 0 && (
          <p style={{ color: "#64748b", padding: 24, textAlign: "center" }}>
            {search ? "No holders match your search" : "No token holders found"}
          </p>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 16 },
  summary: { display: "flex", gap: 16 },
  summaryItem: { flex: 1, background: "#1e293b", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 4 },
  summaryLabel: { color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase" },
  summaryValue: { color: "#e2e8f0", fontSize: 24, fontWeight: 700 },
  controls: { display: "flex", gap: 12, alignItems: "center" },
  search: { flex: 1, padding: "10px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none" },
  sortBtns: { display: "flex", gap: 4 },
  sortBtn: { padding: "8px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 12 },
  sortActive: { padding: "8px 14px", background: "#1e293b", border: "1px solid #22d3ee", borderRadius: 6, color: "#22d3ee", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  tableWrap: { background: "#1e293b", borderRadius: 12, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px 16px", color: "#64748b", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #334155", textTransform: "uppercase" },
  td: { padding: "10px 16px", fontSize: 13, color: "#e2e8f0", borderBottom: "1px solid #0f172a" },
  frozenRow: { background: "#1c1917" },
  frozenBadge: { background: "#7f1d1d", color: "#fca5a5", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  activeBadge: { background: "#052e16", color: "#86efac", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
};
