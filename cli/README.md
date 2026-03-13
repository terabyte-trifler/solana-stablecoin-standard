# SSS Token CLI

Command-line interface for managing Solana Stablecoin Standard tokens.

## Installation

### From Monorepo (Development)

If you're working within the monorepo:

```bash
cd cli
npm install
npm run build
npm link  # Makes 'sss-token' available globally
```

### Standalone Installation

For standalone use, the CLI depends on the SDK via `file:../sdk`. To install:

1. Build the SDK first:

```bash
cd ../sdk
npm install
npm run build
```

2. Then build the CLI:

```bash
cd ../cli
npm install
npm run build
```

### Publishing Strategy

When publishing to npm, you have two options:

1. **Publish SDK separately**: Publish `@stbr/sss-token` to npm, then update CLI's package.json to use the published version:

   ```json
   "@stbr/sss-token": "^0.1.0"
   ```

2. **Bundle SDK with CLI**: Use a bundler to include SDK code directly in the CLI distribution.

## Usage

```bash
# Initialize a new stablecoin
sss-token init --preset sss-1 --name "My Stable" --symbol "MYSTB"

# Check status
sss-token status

# Mint tokens
sss-token mint <recipient> <amount>

# Manage minters
sss-token minters list
sss-token minters add <address> --quota 1000000

# Compliance operations (SSS-2)
sss-token blacklist add <address> --reason "AML violation"
sss-token seize <token-account> --to <treasury> --amount 1000
```

## Global Options

All commands support these global flags:

- `--keypair <path>` - Path to signer keypair (default: `~/.config/solana/id.json`)
- `--url <url>` - RPC URL or cluster name (devnet/mainnet/localnet)
- `--config <pubkey>` - StablecoinConfig PDA address (overrides saved active config)

## Development

```bash
# Run without building
npm run dev -- status

# Build
npm run build

# Clean
npm run clean
```
