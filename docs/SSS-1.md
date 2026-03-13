# SSS-1: Minimal Stablecoin Standard

## Overview

SSS-1 defines the simplest viable stablecoin on Solana. It provides mint authority, freeze authority, and on-chain metadata — everything needed to issue a stable token, nothing more.

Compliance is reactive: freeze individual accounts as needed, but there's no automated enforcement on every transfer.

## When to Use SSS-1

- Internal settlement tokens within an ecosystem
- DAO treasury tokens
- Cross-protocol accounting tokens
- Stablecoins where regulatory compliance is handled off-chain
- Prototyping before upgrading to SSS-2

## Token-2022 Extensions

| Extension | Enabled | Purpose |
|-----------|---------|---------|
| MetadataPointer | Yes | Points to on-chain metadata |
| TokenMetadata | Yes | Stores name, symbol, URI on the mint |
| PermanentDelegate | No | Not needed (no seizure) |
| TransferHook | No | Not needed (no blacklist enforcement) |
| DefaultAccountState | No | Accounts start unfrozen |

## Capabilities

| Operation | Available | Who Can Do It |
|-----------|-----------|---------------|
| Mint tokens | Yes | Master authority, registered minters |
| Burn tokens | Yes | Master authority, registered burners |
| Freeze account | Yes | Master authority |
| Thaw account | Yes | Master authority |
| Pause/unpause | Yes | Pausers (pause), master (unpause) |
| Role management | Yes | Master authority |
| Authority transfer | Yes | Master authority (two-step) |
| Blacklist address | **No** | Requires SSS-2 |
| Seize tokens | **No** | Requires SSS-2 |

## Account Model

Three on-chain accounts are created:

1. **Token-2022 Mint** — the token itself, with metadata extension
2. **StablecoinConfig PDA** — stores name, symbol, decimals, pause state, total supply, authority
3. **RoleManager PDA** — stores minters (with quotas), burners, pausers

## Limitations

- No automated transfer enforcement — a blacklisted address must be frozen manually, and the freeze only prevents that specific token account from transacting. The owner could create a new token account.
- No asset seizure — tokens in a frozen account are stuck forever unless the owner cooperates. There's no permanent delegate to force transfers.
- No compliance audit trail beyond freeze/thaw events.

## Upgrading to SSS-2

SSS-1 cannot be upgraded to SSS-2 in place. Token-2022 extensions are set at mint creation and cannot be added later. To add compliance features, create a new SSS-2 stablecoin and migrate balances.

## Initialization

```typescript
const stable = await SolanaStablecoin.create(connection, {
  preset: "SSS_1",
  name: "My Stablecoin",
  symbol: "MYUSD",
  decimals: 6,
  authority: adminKeypair,
});
```

```bash
sss-token init --preset sss-1 --name "My Stablecoin" --symbol "MYUSD"
```
