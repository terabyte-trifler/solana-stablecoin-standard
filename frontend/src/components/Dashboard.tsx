// frontend/src/components/Dashboard.tsx

import React from "react";
import { StablecoinState } from "../hooks/useStablecoin";
import BN from "bn.js";

interface Props {
  state: StablecoinState;
}

function fmtAmount(amount: BN, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals, str.length - decimals + 2);
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac === "00" ? "" : `.${frac}`);
}

function shortKey(key: any): string {
  const s = key?.toBase58?.() ?? String(key);
  return s.length > 16 ? s.slice(0, 8) + "..." + s.slice(-4) : s;
}

export const Dashboard: React.FC<Props> = ({ state }) => {
  const { config, roles, holders, stablecoin } = state;
  if (!config || !roles) return null;

  const decimals = config.decimals;
  const isSSS2 = stablecoin?.isCompliant ?? false;

  return (
    <div style={styles.grid}>
      {/* Supply card */}
      <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
        <div style={styles.cardLabel}>Total Supply</div>
        <div style={styles.supplyValue}>
          {fmtAmount(config.totalSupply, decimals)}
          <span style={styles.symbolTag}>{config.symbol}</span>
        </div>
      </div>

      {/* Features */}
      <div style={styles.card}>
        <div style={styles.cardLabel}>Features</div>
        <div style={styles.featureList}>
          <Feature label="Permanent Delegate" active={config.enablePermanentDelegate} />
          <Feature label="Transfer Hook" active={config.enableTransferHook} />
          <Feature label="Default Frozen" active={config.defaultAccountFrozen} />
        </div>
      </div>

      {/* Roles summary */}
      <div style={styles.card}>
        <div style={styles.cardLabel}>Roles</div>
        <div style={styles.roleGrid}>
          <RoleCount label="Minters" count={roles.minters.length} color="#22d3ee" />
          <RoleCount label="Burners" count={roles.burners.length} color="#3b82f6" />
          <RoleCount label="Pausers" count={roles.pausers.length} color="#eab308" />
          {isSSS2 && <RoleCount label="Blacklisters" count={roles.blacklisters.length} color="#a855f7" />}
          {isSSS2 && <RoleCount label="Seizers" count={roles.seizers.length} color="#ef4444" />}
        </div>
      </div>

      {/* Authority */}
      <div style={styles.card}>
        <div style={styles.cardLabel}>Authority</div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Master</span>
          <span style={styles.infoValue}>{shortKey(config.masterAuthority)}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Pending Transfer</span>
          <span style={{ ...styles.infoValue, color: config.pendingMasterAuthority ? "#eab308" : "#475569" }}>
            {config.pendingMasterAuthority ? shortKey(config.pendingMasterAuthority) : "None"}
          </span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Mint Address</span>
          <span style={styles.infoValue}>{shortKey(config.mint)}</span>
        </div>
      </div>

      {/* Holders summary */}
      <div style={styles.card}>
        <div style={styles.cardLabel}>Holders</div>
        <div style={styles.bigNum}>{holders.length}</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          {holders.filter((h) => h.isFrozen).length} frozen accounts
        </div>
      </div>

      {/* Compliance */}
      {isSSS2 && (
        <div style={styles.card}>
          <div style={styles.cardLabel}>Compliance</div>
          <div style={styles.bigNum}>{state.blacklisted.length}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>blacklisted addresses</div>
        </div>
      )}
    </div>
  );
};

const Feature: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ color: active ? "#22c55e" : "#475569" }}>{active ? "●" : "○"}</span>
    <span style={{ color: active ? "#e2e8f0" : "#475569" }}>{label}</span>
  </div>
);

const RoleCount: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span style={{ color: "#94a3b8", fontSize: 13 }}>{label}</span>
    <span style={{ color, fontWeight: 700, fontSize: 18 }}>{count}</span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  card: { background: "#1e293b", borderRadius: 12, padding: 20 },
  cardLabel: { color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  supplyValue: { fontSize: 36, fontWeight: 800, color: "#22c55e", display: "flex", alignItems: "baseline", gap: 8 },
  symbolTag: { fontSize: 16, color: "#64748b", fontWeight: 400 },
  featureList: { display: "flex", flexDirection: "column", gap: 8 },
  roleGrid: { display: "flex", flexDirection: "column", gap: 8 },
  infoRow: { display: "flex", justifyContent: "space-between", padding: "4px 0" },
  infoLabel: { color: "#64748b", fontSize: 13 },
  infoValue: { color: "#e2e8f0", fontSize: 13, fontFamily: "monospace" },
  bigNum: { fontSize: 42, fontWeight: 800, color: "#e2e8f0" },
};
