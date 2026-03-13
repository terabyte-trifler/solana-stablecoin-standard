# Operations Runbook

Step-by-step guide for every `sss-token` CLI command. This is the operator's daily reference.

## Global Options

All commands accept these flags:

```
-k, --keypair <path>    Signer keypair JSON (default: ~/.config/solana/id.json)
-u, --url <url>         RPC URL or cluster name: devnet, mainnet, localnet
-c, --config <pubkey>   StablecoinConfig PDA (default: saved from last init)
```

## 1. Create a Stablecoin

### Preset Mode

```bash
# SSS-1 Minimal
sss-token init --preset sss-1 --name "My Stablecoin" --symbol "MYUSD" --decimals 6

# SSS-2 Compliant
sss-token init --preset sss-2 --name "Compliance USD" --symbol "CUSD"
```

### Custom TOML Config

Create `config.toml`:

```toml
[token]
name = "My Stablecoin"
symbol = "MYUSD"
decimals = 6

[features]
permanent_delegate = true
transfer_hook = true
default_account_frozen = false

[roles]
minters = [
  { address = "Abc...", quota = 1000000000000 }
]
pausers = ["Def..."]
```

```bash
sss-token init --custom config.toml
```

After init, the config PDA is saved to `~/.sss-token/active.json`. All subsequent commands use it automatically.

## 2. Mint Tokens

```bash
sss-token mint <recipient-wallet> <amount>
sss-token mint 7xKXt... 1000000              # 1.0 MYUSD (6 decimals)
sss-token mint 7xKXt... 100.5                # decimal notation works too
sss-token mint 7xKXt... 1000000 --minter path/to/minter-keypair.json
```

Creates the recipient's Associated Token Account automatically if it doesn't exist. Signer must be master authority or a registered minter. Blocked while paused.

## 3. Burn Tokens

```bash
sss-token burn <amount>
sss-token burn 500000
```

Burns from the signer's own token account. Signer must be master authority or a registered burner. Blocked while paused.

## 4. Freeze / Thaw Accounts

```bash
sss-token freeze <token-account-address>
sss-token thaw <token-account-address>
```

Master authority only. Freezing prevents the account from sending or receiving. Allowed while paused (emergency response).

## 5. Pause / Unpause

```bash
sss-token pause        # Signer: master authority or registered pauser
sss-token unpause      # Signer: master authority ONLY
```

Pause blocks mint and burn. Does NOT block freeze, thaw, blacklist, seize, or admin operations. Pausers cannot unpause — this is a safety net.

## 6. Status & Supply

```bash
sss-token status       # Full overview: config, features, roles, supply, pause state
sss-token supply       # Just the total supply number
```

## 7. Minter Management

```bash
sss-token minters list                              # Show all minters with quotas
sss-token minters add <address> --quota 1000000000  # Add minter (quota in smallest units)
sss-token minters add <address>                     # Add minter with unlimited quota
sss-token minters remove <address>                  # Remove minter
```

Master authority only. Allowed while paused. Quota of 0 means unlimited. Quotas reset automatically each Solana epoch (~2.5 days).

## 8. Holder List

```bash
sss-token holders                          # All holders
sss-token holders --min-balance 1000000    # Only holders with >= 1.0 tokens
```

## 9. Blacklist (SSS-2 Only)

```bash
sss-token blacklist add <wallet-address> --reason "OFAC SDN match"
sss-token blacklist remove <wallet-address>
sss-token blacklist check <wallet-address>    # Returns blacklisted or not
sss-token blacklist list                      # All blacklisted addresses
```

Blacklists wallet owner addresses (not token accounts). The transfer hook blocks all transfers involving blacklisted owners. Signer must be master authority or registered blacklister. Allowed while paused.

## 10. Seize (SSS-2 Only)

```bash
sss-token seize <source-token-account> --to <treasury-token-account> --amount 1000000
```

Transfers tokens from any account to the treasury via the permanent delegate. Does NOT require the source to be frozen or blacklisted first. Signer must be master authority or registered seizer. Allowed while paused.

## 11. Audit Log

```bash
sss-token audit-log                              # Last 100 events
sss-token audit-log --action mint --limit 50     # Filter by action
sss-token audit-log --export report.json         # Export to file
```

Actions: `mint`, `burn`, `freeze`, `thaw`, `pause`, `unpause`, `blacklist`, `unblacklist`, `seize`, `minter-add`, `minter-remove`, `role`, `authority`.

## Common Workflows

### Onboard a New Minter

```bash
sss-token minters add <new-minter-address> --quota 5000000000
sss-token minters list    # Verify
```

### Emergency Pause

```bash
sss-token pause
sss-token status          # Verify paused
# ... investigate issue ...
sss-token unpause         # Must use master authority
```

### Compliance Enforcement (SSS-2)

```bash
sss-token blacklist add <suspect> --reason "OFAC SDN list match"
sss-token blacklist check <suspect>
sss-token freeze <suspect-token-account>
sss-token seize <suspect-token-account> --to <treasury> --amount <full-balance>
sss-token audit-log --action seize --export compliance-report.json
```

### Authority Handoff

Authority transfer is supported on-chain and in tests, but the CLI commands are not exposed yet in the current `sss-token` CLI build.

Use SDK/program calls for now, or add explicit CLI wiring before using this workflow operationally.
