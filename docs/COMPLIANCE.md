# Compliance Guide

Regulatory considerations, audit trail format, and sanctions screening integration for SSS-2 stablecoins.

## Regulatory Framework

SSS-2 is designed to satisfy the on-chain requirements of the GENIUS Act (Guiding and Establishing National Innovation for U.S. Stablecoins Act, signed June 2025). The GENIUS Act classifies stablecoin issuers as financial institutions subject to the Bank Secrecy Act, requiring AML/CFT programs, OFAC sanctions compliance, and operational controls.

SSS-2 provides the on-chain infrastructure. Issuers are responsible for implementing the off-chain compliance program (KYC, transaction monitoring, regulatory reporting) that wraps around these capabilities.

## On-Chain Compliance Capabilities

### Sanctions Enforcement (OFAC)

The transfer hook checks every transfer against the blacklist atomically. There is no window where a sanctioned address can transact. To enforce OFAC compliance:

1. Screen addresses against OFAC SDN list (via external API or manual review)
2. Call `blacklist add` for matched addresses
3. The transfer hook automatically blocks all future transfers
4. Use `seize` to recover tokens if required by court order

### Asset Freeze

Any token account can be frozen by the master authority. Freezing prevents the account from sending or receiving tokens. This satisfies the "regulatory asset freeze" requirement.

### Asset Recovery / Seizure

The permanent delegate can transfer tokens from any account without the owner's consent. This satisfies the "regulatory asset seizure" requirement for court-ordered recovery.

### Audit Trail

Every operation emits an on-chain Anchor event that persists permanently in Solana's transaction ledger. Events include the actor, timestamp, affected address, and relevant details.

## Audit Trail Format

### Event Types

| Event | Trigger | Key Fields |
|-------|---------|------------|
| StablecoinInitialized | init | config, mint, preset, authority |
| TokensMinted | mint | recipient, amount, minter, new_total_supply |
| TokensBurned | burn | amount, burner, new_total_supply |
| AccountFrozen | freeze | token_account, account_owner, frozen_by |
| AccountThawed | thaw | token_account, account_owner, thawed_by |
| StablecoinPaused | pause | paused_by |
| StablecoinUnpaused | unpause | unpaused_by |
| AddressBlacklisted | blacklist add | address, reason, blacklisted_by |
| AddressRemovedFromBlacklist | blacklist remove | address, removed_by |
| TokensSeized | seize | from_token_account, from_owner, to_token_account, amount, seized_by |
| MinterAdded | add minter | minter, quota, added_by |
| MinterRemoved | remove minter | minter, removed_by |
| RoleGranted | grant role | role, grantee, granted_by |
| RoleRevoked | revoke role | role, revokee, revoked_by |
| AuthorityTransferProposed | transfer authority | proposed_authority |
| AuthorityTransferAccepted | accept authority | previous_authority, new_authority |

### Export Formats

**JSON** — via CLI or backend API:
```bash
sss-token audit-log --export report.json
# Or: GET /api/audit?format=json&limit=500
```

**CSV** — via backend API:
```
GET /api/audit?format=csv&limit=500
```

The CSV format includes columns: `event`, `signature`, `slot`, `blockTime`, `data` (JSON-encoded).

### Retention

On-chain events are permanent — they exist in Solana's ledger as long as the transaction history is retained by validators. The backend's in-memory indexer keeps the most recent 10,000 events for fast API queries. For long-term storage, export periodically to your compliance database.

## Sanctions Screening Integration

The backend provides an integration point for external sanctions screening APIs. The default implementation is a stub that returns "no match" for all addresses.

### Supported Providers

Replace the stub with your provider:

| Provider | API | What It Checks |
|----------|-----|---------------|
| Chainalysis KYT | `api.chainalysis.com` | Address risk scoring, sanctions |
| Elliptic Lens | `api.elliptic.co` | Wallet screening, risk assessment |
| TRM Labs | `api.trmlabs.com` | Address screening, entity resolution |
| OFAC Direct | SDN list download | Direct SDN list lookup |

### Configuration

```env
SANCTIONS_API_URL=https://api.chainalysis.com/v2
SANCTIONS_API_KEY=your-api-key
```

### API Endpoint

```
POST /api/screen
{ "address": "wallet-address", "autoEnforce": true }
```

When `autoEnforce` is true and a sanctions match is found, the address is automatically blacklisted with the reason from the screening result.

### Auto-Enforcement Flow

```
1. New address detected (via indexer event)
2. Backend calls POST /api/screen { address, autoEnforce: true }
3. Sanctions API returns match → backend calls blacklistAdd
4. Transfer hook blocks all future transfers for that address
5. Webhook notification sent to compliance team
6. Compliance team reviews and decides on seizure
```

## Operational Recommendations

**Key management:** Use multisig wallets for master authority and seizer keys. A compromised seizer key can transfer tokens from any account.

**Monitoring:** Set up webhook notifications for all compliance events. The backend's webhook service supports HMAC-signed POSTs with retry logic.

**Periodic screening:** Run batch screening against all holders periodically. Use `GET /api/holders` to get the full holder list, then screen each address.

**Record keeping:** Export audit logs regularly (weekly or monthly) to your compliance database. On-chain events are permanent, but RPC providers may have transaction history retention limits.

**Incident response:** Keep the pauser key readily accessible. In an emergency, pause stops all minting/burning while compliance operations (freeze, blacklist, seize) continue to work.

## Disclaimer

This software provides on-chain infrastructure for compliance. It is NOT legal advice. Issuers must work with qualified legal counsel to design their complete compliance program. The software is not audited. Use at your own risk.
