#!/usr/bin/env node
// tui/src/index.tsx
//
// Interactive Admin TUI — real-time stablecoin dashboard.
//
// Usage:
//   sss-dashboard                               # uses saved active config
//   sss-dashboard --config <pubkey> --url devnet

import React from "react";
import { render } from "ink";
import { App } from "./App.js";
import fs from "fs";
import os from "os";
import path from "path";

// Parse CLI args
const args = process.argv.slice(2);
let configPda: string | undefined;
let rpcInput: string | undefined;

function resolveRpcUrl(input?: string): string {
  if (!input) return "https://api.devnet.solana.com";

  switch (input.toLowerCase()) {
    case "localnet":
      return "http://127.0.0.1:8899";
    case "devnet":
      return "https://api.devnet.solana.com";
    case "mainnet":
    case "mainnet-beta":
      return "https://api.mainnet-beta.solana.com";
    default:
      return input;
  }
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--config" && args[i + 1]) configPda = args[++i];
  if (args[i] === "--url" && args[i + 1]) rpcInput = args[++i];
}

// If no config from args, try loading saved active config
if (!configPda) {
  try {
    const stateFile = path.join(os.homedir(), ".sss-token", "active.json");
    if (fs.existsSync(stateFile)) {
      const active = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      configPda = active.configPda || active.config;
      rpcInput = rpcInput || active.rpcUrl || active.url || active.network;
    }
  } catch {}
}

if (!configPda) {
  console.error("No stablecoin config found. Run 'sss-token init' first or pass --config <pubkey>");
  process.exit(1);
}

render(<App configPda={configPda!} rpcUrl={resolveRpcUrl(rpcInput)} />);
