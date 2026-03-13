# DEVNET_PROOF

This file records proof artifacts for the Solana Stablecoin Standard submission on **Devnet**.

## 1. Program IDs (Devnet)

- `sss-token`: `sW63DevsGFLUj9hsGutuqazT6zGJr7vvWG4FusG6tTk`
- `sss-transfer-hook`: `8hCc8wEKWuSVqQLo5HKwEYuJVR7GaQTxcXw8he38ZVUK`

Source of truth:
- `/Users/terabyte_trifler/Documents/solana-stablecoin-standard/README.md`
- `/Users/terabyte_trifler/Documents/solana-stablecoin-standard/PROGRAM_IDS.md`

## 2. Quick Devnet Funding + TX Checklist

### A. Funding

```bash
solana config set --url devnet
solana balance --url devnet

# If faucet works:
solana airdrop 2 --url devnet

# If faucet is rate-limited:
# 1) use a different funded devnet keypair, or
# 2) transfer devnet SOL from another wallet to your signer.
```

### B. Fresh transaction generation

```bash
cd /Users/terabyte_trifler/Documents/solana-stablecoin-standard/cli

# SSS-1
npm exec sss-token -- --url devnet init --preset sss-1 --name "Proof USD 1" --symbol "PUSD1"
npm exec sss-token -- --url devnet mint <RECIPIENT_WALLET> 100
npm exec sss-token -- --url devnet freeze <RECIPIENT_TOKEN_ACCOUNT>
npm exec sss-token -- --url devnet thaw <RECIPIENT_TOKEN_ACCOUNT>
npm exec sss-token -- --url devnet burn 100

# SSS-2
npm exec sss-token -- --url devnet init --preset sss-2 --name "Proof USD 2" --symbol "PUSD2"
npm exec sss-token -- --url devnet mint <RECIPIENT_WALLET> 50
npm exec sss-token -- --url devnet blacklist add <WALLET_TO_BLACKLIST> --reason "proof-run"
# Optional:
# npm exec sss-token -- --url devnet seize <SOURCE_TOKEN_ACCOUNT> --to <TREASURY_TOKEN_ACCOUNT> --amount 50
```

### C. Verify each signature before adding

```bash
solana confirm <SIGNATURE> --url devnet
```

Only include signatures where output is not `Not found`.

## 3. Transaction Signatures (Paste fresh values here)

### SSS-1 operations

- Init (`initialize`): `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
- Mint: `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
- Freeze: `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
- Thaw: `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
- Burn: `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`

### SSS-2 compliance operations

- Init (`initialize`): `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
- Init hook accounts: `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
- Mint: `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
- Blacklist add: `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`
- Seize (optional): `<SIGNATURE>`
  - Explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`



