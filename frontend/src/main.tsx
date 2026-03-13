// frontend/src/main.tsx

import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { App } from "./App";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";

function resolveEndpoint(): string {
  const fromEnv = import.meta.env.VITE_SOLANA_RPC_URL as string | undefined;
  if (fromEnv) return fromEnv;

  const params = new URLSearchParams(window.location.search);
  const cluster = params.get("cluster");

  if (cluster === "localnet") return "http://127.0.0.1:8899";
  if (cluster === "mainnet") return clusterApiUrl("mainnet-beta");
  return clusterApiUrl("devnet");
}

const Root: React.FC = () => {
  const endpoint = useMemo(() => resolveEndpoint(), []);
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
