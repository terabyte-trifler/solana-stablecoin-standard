# Program ID Configuration

## Current Deployed Program IDs

### Localnet

- **sss_token**: `6eJdqPGX3sJ4GFBty84t7M68RMYMAdiUMVf8PTnybVFT`
- **sss_transfer_hook**: `Dk2cTeG43bahYQs5NBDUCtRqJDSx3L6jknFRCKYYRZPs`

### Devnet (Legacy - DO NOT USE)

- **sss_token**: `sW63DevsGFLUj9hsGutuqazT6zGJr7vvWG4FusG6tTk`
- **sss_transfer_hook**: `8hCc8wEKWuSVqQLo5HKwEYuJVR7GaQTxcXw8he38ZVUK`

## Files That Must Match

When deploying or updating program IDs, ensure ALL of these files are updated:

### Rust Programs

1. `programs/sss-token/src/lib.rs` - `declare_id!(...)`
2. `programs/sss-transfer-hook/src/lib.rs` - `declare_id!(...)`
3. `programs/sss-token/src/constants.rs` - `TRANSFER_HOOK_PROGRAM_ID`
4. `programs/sss-transfer-hook/src/lib.rs` - `SSS_TOKEN_PROGRAM_ID` constant

### Anchor Configuration

5. `Anchor.toml` - `[programs.localnet]` or `[programs.devnet]` section

### SDK

6. `sdk/src/pda.ts` - `SSS_TOKEN_PROGRAM_ID` and `SSS_TRANSFER_HOOK_PROGRAM_ID`
7. `sdk/idl/sss_token.json` - `address` field
8. `sdk/idl/sss_token.ts` - `address` type literal

### Generated Files (auto-updated by Anchor)

9. `target/idl/sss_token.json`
10. `target/idl/sss_transfer_hook.json`
11. `target/types/sss_token.ts`
12. `target/types/sss_transfer_hook.ts`

## Rebuild Process After ID Changes

```bash
# 1. Update all source files listed above

# 2. Rebuild Anchor programs
anchor build

# 3. Rebuild SDK (includes copying IDL to dist)
cd sdk
npm run clean
npm run build
cd ..

# 4. Rebuild CLI (refreshes SDK dependency)
cd cli
rm -rf node_modules/@stbr package-lock.json
npm install
npm run build
cd ..
```

## SDK Build Process

The SDK build script automatically:

1. Compiles TypeScript files to `dist/src/`
2. Copies `idl/sss_token.json` to `dist/idl/sss_token.json`

This ensures the runtime package structure matches the import paths in the compiled code.

**Important**: The SDK source imports `../idl/sss_token.json`, which after compilation becomes a relative path from `dist/src/` to `dist/idl/`. The build script must copy the IDL to maintain this relationship.

## Verification Commands

```bash
# Check Rust program IDs
rg "declare_id!" programs/

# Check SDK IDs
rg "SSS_TOKEN_PROGRAM_ID|SSS_TRANSFER_HOOK_PROGRAM_ID" sdk/src/

# Check CLI's resolved SDK
cd cli
node -p "require.resolve('@stbr/sss-token')"
grep -A 2 "SSS_TOKEN_PROGRAM_ID =" node_modules/@stbr/sss-token/dist/src/pda.js
```

## Common Issues

### Issue: CLI uses wrong program IDs

**Cause**: SDK was rebuilt but CLI's node_modules wasn't refreshed

**Solution**:

```bash
cd cli
rm -rf node_modules/@stbr
npm install
npm run build
```

### Issue: "Cannot find module '../idl/sss_token.json'"

**Cause**: SDK build didn't copy IDL files to dist/

**Solution**: Ensure SDK package.json build script includes:

```json
"build": "tsc && mkdir -p dist/idl && cp idl/sss_token.json dist/idl/sss_token.json"
```

Then rebuild:

```bash
cd sdk
npm run clean
npm run build
cd ../cli
rm -rf node_modules/@stbr
npm install
```

### Issue: Program ID mismatch between Rust and SDK

**Cause**: Files updated in one place but not the other

**Solution**: Follow the complete rebuild process above

### Issue: "Program not found" errors

**Cause**: Using devnet IDs on localnet or vice versa

**Solution**: Verify Anchor.toml matches your target network and rebuild everything
