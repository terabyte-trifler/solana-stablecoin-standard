# Solana Stablecoin Standard (SSS)

Open-source modular SDK for creating and managing stablecoins on Solana. Production-ready templates that institutions and builders can fork, customize, and deploy.

Built by [Superteam Brazil](https://github.com/solanabr). Reference: [Solana Vault Standard](https://github.com/solanabr/solana-vault-standard).

## Presets

| Standard | Name | What It Is | Use Case |
|----------|------|-----------|----------|
| **SSS-1** | Minimal Stablecoin | Mint + freeze authority + metadata | Internal tokens, DAO treasuries, settlement |
| **SSS-2** | Compliant Stablecoin | SSS-1 + permanent delegate + transfer hook + blacklist | Regulated stablecoins, GENIUS Act compliance |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Solana Stablecoin Standard                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Layer 3: Standard Presets                                    │
│  ┌───────────────┐  ┌─────────────────────────────────────┐  │
│  │    SSS-1      │  │            SSS-2                    │  │
│  │   Minimal     │  │          Compliant                  │  │
│  │               │  │                                     │  │
│  │ mint_auth +   │  │ SSS-1 + permanent_delegate +        │  │
│  │ freeze_auth + │  │ transfer_hook + blacklist            │  │
│  │ metadata      │  │ enforcement + seize                  │  │
│  └───────┬───────┘  └─────────────────┬───────────────────┘  │
│          │                             │                      │
│  Layer 2: Composable Modules                                  │
│  ┌───────────────┐  ┌─────────────────────────────────────┐  │
│  │  Base Token   │  │      Compliance Module              │  │
│  │  Module       │  │  ┌─────────────┐ ┌───────────────┐ │  │
│  │               │  │  │ Transfer    │ │ Blacklist     │ │  │
│  │ mint, burn,   │  │  │ Hook Prog   │ │ PDAs          │ │  │
│  │ freeze, thaw, │  │  └─────────────┘ └───────────────┘ │  │
│  │ pause, roles  │  │  ┌─────────────┐ ┌───────────────┐ │  │
│  └───────────────┘  │  │ Permanent   │ │ Seize via     │ │  │
│                     │  │ Delegate    │ │ Delegate      │ │  │
│                     │  └─────────────┘ └───────────────┘ │  │
│                     └─────────────────────────────────────┘  │
│                                                               │
│  Layer 1: Base SDK                                            │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Token-2022 Mint + Extensions + Role Management        │   │
│  │  CLI + TypeScript SDK + Backend Services               │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

### SSS-1: Minimal Stablecoin

```bash
# Install CLI
cd cli && npm install && npm link

# Create SSS-1 stablecoin
sss-token init --preset sss-1 --name "My Stablecoin" --symbol "MYUSD"

# Add a minter and mint tokens
sss-token minters add <address> --quota 1000000000000
sss-token mint <recipient> 1000000
sss-token status
```

### SSS-2: Compliant Stablecoin

```bash
# Create SSS-2 stablecoin
sss-token init --preset sss-2 --name "Compliance USD" --symbol "CUSD"

# Add compliance operators
sss-token minters add <address> --quota 1000000000000
# (blacklister and seizer roles require SSS-2)

# Blacklist an address
sss-token blacklist add <address> --reason "OFAC SDN match"

# Seize tokens from a blacklisted account
sss-token seize <token-account> --to <treasury> --amount 1000000
```

### TypeScript SDK

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";

// Create
const stable = await SolanaStablecoin.create(connection, {
  preset: "SSS_2",
  name: "Compliance USD",
  symbol: "CUSD",
  decimals: 6,
  authority: adminKeypair,
});

// Mint
await stable.mint({ recipient: userWallet, amount: new BN(1_000_000), minter: minterKeypair });

// Compliance (SSS-2)
await stable.compliance.blacklistAdd(suspectWallet, "OFAC match", blacklisterKeypair);
await stable.compliance.seize({ from: suspectAta, to: treasuryAta, amount: new BN(500_000), authority: seizerKeypair });
```

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set STABLECOIN_CONFIG=YOUR_CONFIG_PDA
docker compose up
```

### Frontends

```bash
# Web frontend (Vite + React)
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
# Open: http://127.0.0.1:5173/?cluster=localnet
#        http://127.0.0.1:5173/               (devnet default)

# Interactive terminal dashboard (Ink TUI)
cd ../tui
npm install
npm run dev -- --config <STABLECOIN_CONFIG_PDA> --url localnet
```

Web frontend screens:
- Connect (load config PDA)
- Dashboard (supply, features, roles, authority, holder stats)
- Mint/Burn panel
- Holders table (search + sort)
- Compliance panel (SSS-2 blacklist visibility)

Current frontend write-path status:
- The web app is production-friendly for read/query flows.
- Write actions that require privileged signers (mint/burn/blacklist mutation) should be executed via CLI/backend until wallet-adapter signer support is added to the SDK write path.

## Installation

### Prerequisites

- Rust (stable), Solana CLI (v2.x), Anchor (v0.31.x), Node.js 18+, Docker

### Build

```bash
# Clone
git clone https://github.com/solanabr/solana-stablecoin-standard
cd solana-stablecoin-standard

# Build on-chain programs
anchor build

# Build SDK
cd sdk && npm install && npm run build

# Build CLI
cd ../cli && npm install && npm run build && npm link

# Build backend
cd ../backend && npm install && npm run build

# Build web frontend
cd ../frontend && npm install && npm run build

# Build TUI
cd ../tui && npm install && npm run build
```

### Deploy

```bash
solana config set --url devnet
anchor deploy
# Record program IDs from output
```

### Test

```bash
anchor test                         # All tests
anchor test -- --grep "SSS-1"      # SSS-1 only
anchor test -- --grep "SSS-2"      # SSS-2 only
```

## Program IDs

| Program | Devnet | Mainnet |
|---------|--------|---------|
| sss-token | `sW63DevsGFLUj9hsGutuqazT6zGJr7vvWG4FusG6tTk` | `Not deployed` |
| sss-transfer-hook | `8hCc8wEKWuSVqQLo5HKwEYuJVR7GaQTxcXw8he38ZVUK` | `Not deployed` |

Localnet IDs change on each fresh deploy. See `Anchor.toml` and `PROGRAM_IDS.md` for your current environment.

## Project Structure

```
solana-stablecoin-standard/
├── programs/
│   ├── sss-token/           # Main stablecoin program (18 instructions)
│   └── sss-transfer-hook/   # Transfer hook for blacklist enforcement
├── sdk/                     # @stbr/sss-token TypeScript SDK
├── cli/                     # sss-token CLI tool
├── frontend/                # React/Vite operator web UI
├── tui/                     # Ink-based terminal dashboard (sss-dashboard)
├── backend/                 # REST API + event indexer + Docker
├── tests/                   # Anchor integration tests (59 test cases)
├── trident-tests/           # Fuzz tests via Trident
└── docs/                    # Full documentation suite
```

## Documentation

| Document | Description |
|----------|------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layer model, data flows, PDA derivation, security |
| [SDK.md](docs/SDK.md) | TypeScript SDK reference with examples |
| [OPERATIONS.md](docs/OPERATIONS.md) | Operator runbook for every CLI command |
| [SSS-1.md](docs/SSS-1.md) | Minimal stablecoin standard spec |
| [SSS-2.md](docs/SSS-2.md) | Compliant stablecoin standard spec |
| [COMPLIANCE.md](docs/COMPLIANCE.md) | Regulatory considerations, GENIUS Act alignment |
| [API.md](docs/API.md) | Backend REST API reference |

## Security

- Role-based access control with no single-key ownership
- Two-step authority transfer prevents accidental lockout
- Per-epoch minter quotas limit blast radius of compromised keys
- Transfer hook enforces blacklist on every transfer atomically
- Permanent delegate enables court-ordered asset recovery
- All operations emit events for audit trail
- **Audit Status:** Not yet audited. Use at your own risk.

## License

MIT
