# Backend API Reference

Base URL: `http://localhost:3000`

## Health

### GET /health

Deep health check with component status.

Response (200 healthy, 503 degraded):
```json
{
  "status": "healthy",
  "timestamp": "2025-03-14T12:00:00.000Z",
  "checks": {
    "solanaRpc": { "status": "ok", "latency": 42, "detail": "slot 312456789" },
    "stablecoin": { "status": "ok", "detail": "Test USD (TUSD) — active" },
    "indexer": { "status": "ok", "detail": "847 events indexed" },
    "authority": { "status": "ok", "detail": "configured (7xKXt...)" }
  }
}
```

### GET /health/ready

Kubernetes readiness probe. Returns 200 when RPC is reachable.

### GET /health/live

Kubernetes liveness probe. Returns 200 if the process is alive.

## Token Operations

### POST /api/mint

Mint tokens to a recipient.

Request:
```json
{
  "recipient": "7xKXtJ2FpGA...",
  "amount": "1000000",
  "idempotencyKey": "mint-order-12345"
}
```

Response (200):
```json
{
  "status": "success",
  "signature": "5o12ZTvc...",
  "amount": "1000000",
  "timestamp": "2025-03-14T12:00:00.000Z"
}
```

`amount` is in smallest units (1000000 = 1.0 with 6 decimals). `idempotencyKey` is optional — duplicate requests with the same key return the cached result.

### POST /api/burn

Burn tokens from the backend's authority wallet.

Request:
```json
{
  "amount": "500000",
  "idempotencyKey": "burn-order-789"
}
```

Response: same format as mint.

### GET /api/supply

Returns current total supply.

Response:
```json
{
  "totalSupply": "15000000000",
  "decimals": 6
}
```

### GET /api/status

Full stablecoin configuration, features, roles, and indexer stats.

Response:
```json
{
  "name": "Test USD",
  "symbol": "TUSD",
  "decimals": 6,
  "mint": "TokenMint...",
  "totalSupply": "15000000000",
  "isPaused": false,
  "preset": "SSS-2",
  "features": {
    "permanentDelegate": true,
    "transferHook": true,
    "defaultAccountFrozen": false
  },
  "authority": {
    "master": "7xKXt...",
    "pendingTransfer": null
  },
  "roles": {
    "minters": [
      { "address": "Abc...", "quota": "10000000000", "minted": "500000", "lastResetEpoch": "725" }
    ],
    "burners": ["Def..."],
    "pausers": ["Ghi..."],
    "blacklisters": ["Jkl..."],
    "seizers": ["Mno..."]
  },
  "indexerStats": {
    "totalMinted": "15000000000",
    "totalBurned": "0",
    "mintCount": 42,
    "burnCount": 0,
    "freezeCount": 3,
    "blacklistCount": 1,
    "seizeCount": 0,
    "totalEvents": 847
  }
}
```

### GET /api/holders

List all token holders.

Query params: `minBalance` (optional, smallest units).

Response:
```json
{
  "count": 156,
  "holders": [
    {
      "owner": "7xKXt...",
      "tokenAccount": "ATAabc...",
      "balance": "5000000000",
      "isFrozen": false
    }
  ]
}
```

### GET /api/events

Indexed events from the in-memory store.

Query params: `name` (event type), `limit` (default 100), `offset` (default 0).

Response:
```json
{
  "count": 50,
  "stats": { "totalEvents": 847 },
  "events": [
    {
      "id": 847,
      "name": "TokensMinted",
      "data": { "recipient": "7xKXt...", "amount": "1000000", "minter": "Abc..." },
      "signature": "5o12ZTvc...",
      "slot": 0,
      "timestamp": "2025-03-14T12:00:00.000Z"
    }
  ]
}
```

## Compliance (SSS-2)

### POST /api/blacklist

Add an address to the blacklist.

Request:
```json
{
  "address": "SuspectWallet...",
  "reason": "OFAC SDN match — list update 2025-03-01"
}
```

Response:
```json
{
  "status": "success",
  "signature": "4F4Vhi..."
}
```

### DELETE /api/blacklist/:address

Remove an address from the blacklist.

Response: same format as POST.

### GET /api/blacklist/:address

Check if a specific address is blacklisted.

Response:
```json
{
  "address": "SuspectWallet...",
  "blacklisted": true,
  "entry": {
    "reason": "OFAC SDN match",
    "blacklistedAt": "1710417600",
    "blacklistedBy": "Blacklister..."
  }
}
```

### GET /api/blacklist

List all blacklisted addresses.

Response:
```json
{
  "count": 3,
  "entries": [
    {
      "address": "Suspect1...",
      "reason": "OFAC SDN match",
      "blacklistedAt": "1710417600",
      "blacklistedBy": "Blacklister..."
    }
  ]
}
```

### POST /api/screen

Screen an address against sanctions lists.

Request:
```json
{
  "address": "WalletToScreen...",
  "autoEnforce": false
}
```

Response (screening only):
```json
{
  "address": "WalletToScreen...",
  "isMatch": false,
  "source": "stub",
  "matchType": null,
  "details": "No sanctions API configured — stub response",
  "timestamp": "2025-03-14T12:00:00.000Z"
}
```

Response (with `autoEnforce: true` and match found):
```json
{
  "screening": { "isMatch": true, "source": "external-api", "matchType": "OFAC SDN" },
  "blacklisted": true,
  "signature": "Auto-blacklist tx..."
}
```

### GET /api/audit

Export the on-chain audit trail.

Query params: `format` (`json` or `csv`), `limit` (default 100).

JSON response:
```json
{
  "eventCount": 42,
  "generatedAt": "2025-03-14T12:00:00.000Z",
  "events": [ ... ]
}
```

CSV response: sets `Content-Disposition: attachment` header with columns `event,signature,slot,blockTime,data`.

## Error Format

All errors return:
```json
{
  "error": "Description of what went wrong"
}
```

Status codes: 400 (bad request / validation), 404 (not found), 500 (internal error), 503 (service unavailable).

## Authentication

The backend does not implement authentication by default. In production, add API key validation or OAuth middleware. The authority keypair is loaded from the filesystem — protect it with appropriate file permissions.

## Webhooks

When `WEBHOOK_URL` is configured, the backend POSTs events to that URL:

```json
{
  "id": "uuid-v4",
  "event": "mint.completed",
  "timestamp": "2025-03-14T12:00:00.000Z",
  "data": { "signature": "...", "recipient": "...", "amount": "..." }
}
```

Headers: `Content-Type: application/json`, `X-SSS-Signature: hmac-sha256-hex`, `X-SSS-Event: event-name`, `X-SSS-Delivery: uuid`.

Retry: 3 attempts with exponential backoff (1s, 2s, 4s).

Webhook events: `mint.completed`, `mint.failed`, `burn.completed`, `burn.failed`, `compliance.blacklisted`, `compliance.unblacklisted`, and all indexed on-chain events.
