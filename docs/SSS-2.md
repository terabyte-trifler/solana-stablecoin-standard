# SSS-2: Compliant Stablecoin Standard

## Overview

SSS-2 extends SSS-1 with proactive compliance enforcement. Every transfer is checked against a blacklist in real-time, and authorized operators can seize tokens from any account via a permanent delegate.

SSS-2 is designed for regulated stablecoins — tokens where regulators expect on-chain blacklist enforcement, token seizure capabilities, and a complete audit trail. It maps directly to the requirements of the GENIUS Act.

## When to Use SSS-2

- Stablecoins subject to AML/BSA requirements
- Tokens that must comply with OFAC sanctions
- GENIUS Act compliant payment stablecoins
- Any token where regulators require on-chain enforcement

## Token-2022 Extensions

| Extension | Enabled | Purpose |
|-----------|---------|---------|
| MetadataPointer | Yes | On-chain metadata |
| TokenMetadata | Yes | Name, symbol, URI |
| PermanentDelegate | **Yes** | Enables seize (clawback/asset recovery) |
| TransferHook | **Yes** | Blacklist enforcement on every transfer |
| DefaultAccountState | Optional | All new accounts start frozen (KYC gate) |

## Capabilities

All SSS-1 capabilities plus:

| Operation | Available | Who Can Do It |
|-----------|-----------|---------------|
| Blacklist address | Yes | Master authority, registered blacklisters |
| Remove from blacklist | Yes | Master authority, registered blacklisters |
| Check blacklist | Yes | Anyone (read-only) |
| Seize tokens | Yes | Master authority, registered seizers |
| Transfer blocked by blacklist | Automatic | Transfer hook (every transfer) |

## Compliance Architecture

```
               ┌─────────────────────────────┐
               │   Wallet Attempts Transfer   │
               └──────────────┬──────────────┘
                              │
                              ▼
               ┌─────────────────────────────┐
               │  Token-2022 transfer_checked │
               │  (processes base transfer)   │
               └──────────────┬──────────────┘
                              │
                              ▼
               ┌─────────────────────────────┐
               │  Transfer Hook Invoked       │
               │  (sss-transfer-hook program) │
               └──────────────┬──────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
           ┌──────────────┐   ┌──────────────┐
           │ Sender on    │   │ Receiver on  │
           │ blacklist?   │   │ blacklist?   │
           └──────┬───────┘   └──────┬───────┘
                  │                   │
           Either YES → REJECT transfer
           Both NO   → ALLOW transfer
```

## Blacklist Design

**What is blacklisted:** wallet owner addresses, not individual token accounts. A wallet owner can create unlimited token accounts, so blacklisting by owner covers all of them.

**How it works:** each blacklisted address gets a `BlacklistEntry` PDA. The transfer hook derives the PDA for the sender's owner and receiver's owner, then checks if those PDAs exist on-chain. PDA existence = blacklisted.

**Audit trail:** every blacklist add/remove emits an on-chain event. Even after removal (PDA closure), the event history in Solana's ledger is permanent.

## Seize (Permanent Delegate)

The PermanentDelegate extension gives the StablecoinConfig PDA authority to call `transfer_checked` on ANY token account of this mint. This is the "seize" mechanism.

**Policy decisions:**
- Partial seizure is supported (specify exact amount)
- Source account does NOT need to be frozen first
- Destination can be any token account for the same mint
- Can seize from any account, not just blacklisted ones
- Does NOT change total supply (it's a transfer, not destruction)
- Allowed while the stablecoin is paused

## GENIUS Act Alignment

The GENIUS Act (signed June 2025) establishes requirements for regulated payment stablecoins. SSS-2 maps to these requirements:

| GENIUS Act Requirement | SSS-2 Implementation |
|---|---|
| AML/BSA compliance | Blacklist enforcement blocks sanctioned addresses |
| OFAC sanctions screening | Sanctions screening integration point in backend |
| Asset freeze capability | Freeze authority on all token accounts |
| Asset seizure/recovery | Permanent delegate enables forced transfers |
| Audit trail | All operations emit on-chain events |
| Reserve transparency | Total supply tracked on-chain, queryable via API |
| Redemption procedures | Burn instruction with role-based access |
| Reporting | Audit log export (JSON/CSV) via backend API |

## Default Frozen Mode

When `defaultAccountFrozen = true`:

- All new token accounts start in a frozen state
- Users cannot transact until the master authority thaws their account
- This creates a KYC gate: only approved users can hold the token
- Thawing is allowed while the stablecoin is globally paused
- Operational flow: user requests account → KYC check → authority thaws → user can transact

## Initialization

```typescript
const stable = await SolanaStablecoin.create(connection, {
  preset: "SSS_2",
  name: "Compliance USD",
  symbol: "CUSD",
  decimals: 6,
  authority: adminKeypair,
});
```

```bash
sss-token init --preset sss-2 --name "Compliance USD" --symbol "CUSD"
```

The SDK automatically calls both `initialize` and `init_hook_accounts` to set up the transfer hook.

## Limitations

- ConfidentialTransfer and TransferHook cannot coexist on the same mint. Privacy-preserving transfers require a separate approach (future SSS-3).
- Blacklist checks add ~5,000 compute units per transfer (hook invocation).
- The permanent delegate has unlimited transfer power — seizer keys must be protected with extreme care (multisig recommended).
