// frontend/src/components/ConnectPanel.tsx

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Props {
  onConnect: (configPda: string) => void;
}

export const ConnectPanel: React.FC<Props> = ({ onConnect }) => {
  const wallet = useWallet();
  const [pdaInput, setPdaInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const handleLoad = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pdaInput.trim()) return setError("Enter a config PDA address");
    try {
      onConnect(pdaInput.trim());
    } catch {
      setError("Invalid public key");
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Load Stablecoin Config</h2>
      <p style={styles.subtle}>Paste your `StablecoinConfig` PDA from CLI `sss-token status` output.</p>

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

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.notice}>
        <p style={styles.noticeTitle}>Create New Stablecoin</p>
        <p style={styles.noticeBody}>
          For now, creation is handled via CLI because SDK `create()` requires a direct `Keypair`
          signer. Wallet-adapter signing support can be added in a follow-up SDK upgrade.
        </p>
        <button style={styles.guideBtn} onClick={() => setShowGuide((v) => !v)}>
          {showGuide ? "Hide CLI commands" : "Show CLI commands"}
        </button>
        {showGuide && (
          <pre style={styles.code}>
{`npm exec sss-token -- --url localnet init --preset sss-1 --name "My USD" --symbol "MYUSD"
npm exec sss-token -- --url localnet status`}
          </pre>
        )}
      </div>

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
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { color: "#94a3b8", fontSize: 13, fontWeight: 500 },
  input: { padding: "10px 14px", background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none" },
  btn: { padding: "12px 24px", background: "linear-gradient(135deg, #14c8b0, #2fd5ff)", border: "none", borderRadius: 10, color: "#062036", cursor: "pointer", fontWeight: 700, fontSize: 15, marginTop: 8 },
  notice: { marginTop: 20, padding: 16, borderRadius: 12, border: "1px solid #2d5272", background: "#0d2034" },
  noticeTitle: { color: "#cde7ff", fontWeight: 700, marginBottom: 8 },
  noticeBody: { color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginBottom: 12 },
  guideBtn: { padding: "8px 12px", background: "#173555", border: "1px solid #2d5272", borderRadius: 8, color: "#d5ecff", cursor: "pointer", fontWeight: 600 },
  code: { marginTop: 12, padding: 10, borderRadius: 8, background: "#09192a", color: "#8ee8ff", overflowX: "auto", fontSize: 12, lineHeight: 1.4 },
  error: { color: "#ef4444", marginTop: 12, fontSize: 13 },
};
