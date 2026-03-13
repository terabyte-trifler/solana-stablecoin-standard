# TypeScript SDK Reference

Package: `@stbr/sss-token`

## Installation

```bash
npm install @stbr/sss-token
```

After `anchor build`, copy the IDL: `cp target/idl/sss_token.json sdk/idl/sss_token.json`

## SolanaStablecoin

The main class. All operations go through this.

### Creating a New Stablecoin

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";

// Preset mode — SSS-1
const sss1 = await SolanaStablecoin.create(connection, {
  preset: "SSS_1",
  name: "My Stablecoin",
  symbol: "MYUSD",
  decimals: 6,
  authority: adminKeypair,
});

// Preset mode — SSS-2
const sss2 = await SolanaStablecoin.create(connection, {
  preset: "SSS_2",
  name: "Compliance USD",
  symbol: "CUSD",
  decimals: 6,
  uri: "https://arweave.net/metadata.json",
  authority: adminKeypair,
});

// Custom mode — pick individual extensions
const custom = await SolanaStablecoin.create(connection, {
  name: "Custom Token",
  symbol: "CUST",
  authority: adminKeypair,
  extensions: {
    enablePermanentDelegate: true,
    enableTransferHook: false,
    defaultAccountFrozen: true,
  },
});
```

### Loading an Existing Stablecoin

```typescript
const stable = await SolanaStablecoin.load(connection, configPdaAddress, walletKeypair);
const config = await stable.getConfig();
console.log(`${config.name} — supply: ${config.totalSupply}`);
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `connection` | `Connection` | Solana RPC connection |
| `program` | `Program` | Anchor program instance |
| `configPda` | `PublicKey` | StablecoinConfig PDA address |
| `mint` | `PublicKey` | Token-2022 mint address |
| `roleManagerPda` | `PublicKey` | RoleManager PDA address |
| `isCompliant` | `boolean` | Whether SSS-2 features are available |
| `compliance` | `ComplianceModule` | SSS-2 module (throws on SSS-1) |

### Token Operations

```typescript
// Mint — auto-creates ATA if needed
await stable.mint({
  recipient: userWallet,
  amount: new BN(1_000_000),
  minter: minterKeypair,
});

// Burn — from signer's ATA by default
await stable.burn({ amount: new BN(500_000), burner: burnerKeypair });
// Or specify a token account:
await stable.burn({ amount: new BN(500_000), burner, tokenAccount: specificAta });

// Freeze / Thaw
await stable.freezeAccount(tokenAccountPubkey, authorityKeypair);
await stable.thawAccount(tokenAccountPubkey, authorityKeypair);

// Pause / Unpause
await stable.pause(pauserKeypair);
await stable.unpause(authorityKeypair);  // master only
```

### Role Management

```typescript
import { RoleType } from "@stbr/sss-token";

// Minters (have quotas)
await stable.addMinter(minterPubkey, new BN(10_000_000), authorityKeypair);
await stable.updateMinterQuota(minterPubkey, new BN(20_000_000), authorityKeypair);
await stable.removeMinter(minterPubkey, authorityKeypair);

// Other roles
await stable.grantRole(RoleType.Burner, address, authorityKeypair);
await stable.grantRole(RoleType.Pauser, address, authorityKeypair);
await stable.grantRole(RoleType.Blacklister, address, authorityKeypair);  // SSS-2 only
await stable.grantRole(RoleType.Seizer, address, authorityKeypair);       // SSS-2 only
await stable.revokeRole(RoleType.Burner, address, authorityKeypair);
```

### Authority Transfer

```typescript
// Step 1: propose
await stable.transferAuthority(newAuthorityPubkey, currentAuthorityKeypair);

// Step 2: accept (signed by new authority)
await stable.acceptAuthority(newAuthorityKeypair);

// Cancel
await stable.cancelAuthorityTransfer(currentAuthorityKeypair);
```

### Read Operations

```typescript
const supply = await stable.getTotalSupply();       // BN
const config = await stable.getConfig();             // StablecoinConfigAccount
const roles = await stable.getRoles();               // RoleManagerAccount
const paused = await stable.isPaused();              // boolean
const holders = await stable.getHolders();           // HolderInfo[]
const richHolders = await stable.getHolders(new BN(1_000_000));  // min balance filter
```

## ComplianceModule (SSS-2)

Accessed via `stable.compliance`. Throws if SSS-2 features aren't enabled.

```typescript
// Blacklist management
await stable.compliance.blacklistAdd(walletPubkey, "OFAC SDN match", blacklisterKeypair);
await stable.compliance.blacklistRemove(walletPubkey, blacklisterKeypair);
const blocked = await stable.compliance.isBlacklisted(walletPubkey);          // boolean
const entry = await stable.compliance.getBlacklistEntry(walletPubkey);        // BlacklistEntryAccount | null
const allBlocked = await stable.compliance.getAllBlacklisted();               // BlacklistEntryAccount[]

// Seize tokens
await stable.compliance.seize({
  from: sourceTokenAccount,
  to: treasuryTokenAccount,
  amount: new BN(1_000_000),
  authority: seizerKeypair,
});

// Audit log
const events = await stable.compliance.getAuditLog({ eventType: "TokensMinted", limit: 50 });
const json = await stable.compliance.exportAuditLog({ limit: 100 });
```

## Presets

```typescript
import { Presets, resolveFeatures, getPresetLabel } from "@stbr/sss-token";

console.log(Presets.SSS_1);
// { enablePermanentDelegate: false, enableTransferHook: false, defaultAccountFrozen: false }

console.log(Presets.SSS_2);
// { enablePermanentDelegate: true, enableTransferHook: true, defaultAccountFrozen: false }
```

## PDA Utilities

```typescript
import {
  findStablecoinConfigPda,
  findRoleManagerPda,
  findBlacklistEntryPda,
  findExtraAccountMetaListPda,
  findAta,
  resolveTransferHookAccounts,
} from "@stbr/sss-token";

const [configPda, bump] = findStablecoinConfigPda(mintPubkey);
const [rolesPda] = findRoleManagerPda(configPda);
const [blacklistPda] = findBlacklistEntryPda(configPda, walletPubkey);
const hookAccounts = await resolveTransferHookAccounts(connection, mint, source, dest, configPda);
```

## Types

All interfaces are exported from the package root. Key types: `StablecoinCreateOptions`, `StablecoinConfigAccount`, `RoleManagerAccount`, `BlacklistEntryAccount`, `MintParams`, `BurnParams`, `SeizeParams`, `RoleType`, `HolderInfo`, `AuditLogFilters`, `AuditEvent`.
