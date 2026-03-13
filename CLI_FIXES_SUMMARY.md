# SSS Token CLI Fixes Summary

## Completed Tasks

### 1. CLI Workspace Dependency (✅ DONE)

- Changed from `workspace:*` to `file:../sdk` for standalone installation
- Files: `cli/package.json`, `cli/README.md`

### 2. Global Options Handling (✅ DONE)

- Created `cli/src/global-options.ts` with helper functions
- Documented migration path in `cli/ARCHITECTURE.md`

### 3. Program ID Updates (✅ DONE)

- Updated SDK and programs to use correct localnet IDs:
  - sss_token: `A5nx6XK7PvhxhyzXNtY5ARGCC1WLymkuLKeBYNg78U4q`
  - sss_transfer_hook: `8RU51UBAQKVBRiAJCEsEUbq331ruTp7KF61ranWott1j`
- Created `PROGRAM_IDS.md` documentation

### 4. SDK Package Structure (✅ DONE)

- Fixed package.json paths and IDL copying in build script

### 5. Rust Syntax Fixes (✅ DONE)

- Fixed missing semicolons in constants.rs and lib.rs

### 6. Anchor TypeScript Casing (✅ DONE)

- Converted all snake_case to camelCase for Anchor runtime:
  - Method names: `mintTokens`, `burnTokens`, etc.
  - Account names in `.accounts()` calls
  - Account namespace names in `.fetch()` calls
- Used `as any` type assertions for TypeScript compatibility

### 7. Token-2022 Mint Space Calculation (✅ DONE)

- Fixed space calculation for mint with metadata
- InitializeMint2 requires exact mint+extension size
- Metadata initialization reallocates the account
- Added lamport top-up before metadata init

### 8. SDK load() Method (✅ DONE)

- Fixed to use read-only wallet for status/supply commands
- No longer requires ANCHOR_WALLET env var for read operations

### 9. Transfer Hook Account Forwarding (🔄 IN PROGRESS)

- **Status**: Seize instruction reaches TransferChecked but fails with custom error `0xa261c2c0`
- **Progress**:
  - ✅ Fixed "Unknown program" error - hook program is now being found
  - ✅ Transfer hook is being invoked (confirmed by error change)
  - ✅ Added permanent delegate bypass logic to transfer hook
  - ✅ Redeployed transfer hook program
  - ❌ Still failing with custom error during hook execution

- **Current Issue**:
  - Error: `custom program error: 0xa261c2c0`
  - Token-2022 logs: "Error: Unknown"
  - No logs from hook program (8RU51UB...) visible
  - Suggests hook is returning an error Token-2022 doesn't recognize

- **Verified**:
  - ✅ Mint has TransferHook extension pointing to correct program
  - ✅ ExtraAccountMetaList PDA exists and is owned by hook program
  - ✅ SDK passing 6 remaining accounts in correct order
  - ✅ Rust forwarding all accounts to CPI

- **SDK Remaining Accounts Order**:
  1. extraAccountMetaListPda
  2. SSS_TRANSFER_HOOK_PROGRAM_ID
  3. SSS_TOKEN_PROGRAM_ID
  4. configPda
  5. sourceBlacklistPda
  6. destBlacklistPda

- **Rust CPI Account Order**:
  1. source_token_account
  2. mint
  3. destination_token_account
  4. stablecoin_config (authority/delegate)
     5-10. remaining_accounts (6 hook accounts)

- **Next Steps**:
  - Need to see actual hook program logs to understand why it's failing
  - Verify permanent delegate bypass logic is executing
  - Check if error is from blacklist check or another issue
  - May need to add more debug logging to hook program

## Files Modified

### SDK

- `sdk/src/stablecoin.ts` - camelCase conversions, init confirmation
- `sdk/src/compliance.ts` - camelCase conversions, seize remaining accounts
- `sdk/src/pda.ts` - program ID updates
- `sdk/idl/sss_token.json` - program ID updates
- `sdk/idl/sss_token.ts` - program ID updates
- `sdk/package.json` - build script with IDL copy

### Rust Programs

- `programs/sss-token/src/lib.rs` - program ID
- `programs/sss-token/src/constants.rs` - program IDs, syntax fixes
- `programs/sss-token/src/instructions/initialize.rs` - mint space calculation
- `programs/sss-token/src/instructions/seize.rs` - transfer hook account forwarding
- `programs/sss-transfer-hook/src/lib.rs` - program ID, permanent delegate bypass
- `programs/sss-token/Cargo.toml` - spl-pod dependency
- `Anchor.toml` - program IDs

### CLI

- `cli/package.json` - workspace dependency fix
- `cli/README.md` - installation instructions
- `cli/src/global-options.ts` - new file
- `cli/ARCHITECTURE.md` - global options documentation

### Documentation

- `PROGRAM_IDS.md` - new file
- `CLI_FIXES_SUMMARY.md` - this file

## Build Order

1. Rust programs: `anchor build`
2. SDK: `cd sdk && npm run build`
3. CLI: `cd cli && rm -rf node_modules/@stbr && npm install && npm run build`

## Testing Commands

```bash
# Status (read-only, no wallet needed)
npm exec sss-token -- --url localnet status

# Mint tokens
npm exec sss-token -- --url localnet mint <recipient> <amount>

# Seize tokens (currently failing)
npm exec sss-token -- --url localnet seize <source-token-account> --to <dest-token-account> --amount <amount>
```

## Known Issues

1. **Seize with Transfer Hook**: Currently failing with custom error 0xa261c2c0
   - Hook is being invoked but returning an error
   - Need hook program logs to diagnose
   - Permanent delegate bypass may not be working as expected

## Error Code Reference

- `0xa261c2c0` (2724315840): Unknown Token-2022/hook error
  - Appears when transfer hook rejects the transfer
  - Token-2022 logs "Error: Unknown"
  - Actual cause requires hook program logs to determine
