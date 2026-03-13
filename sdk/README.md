# @stbr/sss-token — Solana Stablecoin Standard SDK

TypeScript SDK for the Solana Stablecoin Standard. Create and manage stablecoins on Solana with two preset architectures.

## Install

```bash
npm install @stbr/sss-token
```

## Quick Start

### SSS-1: Minimal Stablecoin

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";
import { Connection, Keypair } from "@solana/web3.js";
import BN from "bn.js";

const connection = new Connection("https://api.devnet.solana.com");
const admin = Keypair.generate();

// Create SSS-1 stablecoin
const stable = await SolanaStablecoin.create(connection, {
  preset: "SSS_1",
  name: "My Stablecoin",
  symbol: "MYUSD",
  decimals: 6,
  authority: admin,
});

// Add a minter with 1M per-epoch quota
await stable.addMinter(minterWallet, new BN(1_000_000_000_000), admin);

// Mint tokens
await stable.mint({
  recipient: userWallet,
  amount: new BN(100_000_000), // 100 MYUSD
  minter: minterKeypair,
});

// Check supply
const supply = await stable.getTotalSupply();
console.log(`Total supply: ${supply.toString()}`);
```

### SSS-2: Compliant Stablecoin

```typescript
const regulated = await SolanaStablecoin.create(connection, {
  preset: "SSS_2",
  name: "Compliance USD",
  symbol: "CUSD",
  decimals: 6,
  authority: admin,
});

// Compliance operations via .compliance module
await regulated.compliance.blacklistAdd(
  suspectWallet,
  "OFAC SDN match",
  blacklisterKeypair
);

// Check blacklist status
const isBlocked = await regulated.compliance.isBlacklisted(suspectWallet);

// Seize tokens
await regulated.compliance.seize({
  from: suspectTokenAccount,
  to: treasuryAccount,
  amount: new BN(500_000_000),
  authority: seizerKeypair,
});

// Export audit trail
const auditJson = await regulated.compliance.exportAuditLog();
```

### Load Existing Stablecoin

```typescript
const loaded = await SolanaStablecoin.load(connection, configPdaAddress);
const config = await loaded.getConfig();
console.log(`${config.name} (${config.symbol})`);
console.log(`Supply: ${config.totalSupply}`);
console.log(`Paused: ${config.isPaused}`);
```

## API Reference

See [SDK.md](../docs/SDK.md) for the full API reference.

## Setup

After `anchor build`, copy the generated IDL:

```bash
cp target/idl/sss_token.json sdk/idl/sss_token.json
cd sdk && npm install && npm run build
```
