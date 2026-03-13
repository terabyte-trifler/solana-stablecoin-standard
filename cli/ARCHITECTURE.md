# CLI Architecture Notes

## Dependency Strategy

### Current Approach

The CLI uses `"@stbr/sss-token": "file:../sdk"` which works for:

- Monorepo development
- Local testing
- npm install from the repository

### Limitations

This approach requires:

1. The SDK to be built before installing the CLI
2. Both packages to exist in the same directory structure
3. Manual coordination when publishing

### Publishing Options

When ready to publish, choose one of these strategies:

#### Option 1: Publish SDK Separately (Recommended)

1. Publish `@stbr/sss-token` to npm registry
2. Update CLI's package.json:
   ```json
   "@stbr/sss-token": "^0.1.0"
   ```
3. Publish CLI to npm registry

Benefits:

- Clean separation of concerns
- SDK can be used independently
- Standard npm workflow

#### Option 2: Bundle SDK with CLI

Use a bundler (esbuild, webpack) to include SDK code directly in CLI distribution.

Benefits:

- Single package to install
- No external SDK dependency

Drawbacks:

- Larger package size
- SDK not available for other consumers

## Global Options Handling

### Problem

The original implementation used brittle parent chain traversal:

```typescript
const g = program.opts();
const parentOpts = opts.parent?.opts();
const grandparentOpts = opts.parent?.parent?.opts();
```

This pattern:

- Is fragile and easy to break
- Requires manual tracking of command nesting depth
- Duplicates logic across commands

### Solution

Created `cli/src/global-options.ts` with centralized helpers:

```typescript
import { getGlobalOptions, mergeOptions } from "./global-options";

// In any command handler:
const globalOpts = getGlobalOptions(cmd);
const allOpts = mergeOptions(globalOpts, commandOpts);
```

### Migration Path

The current implementation still uses the manual pattern in `cli/src/index.ts`:

```typescript
.action((recipient, amount, opts) => {
  const g = program.opts();
  mintCommand(recipient, amount, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
```

To migrate to the centralized approach:

1. Pass the Command instance to handlers
2. Use `getGlobalOptions()` inside command implementations
3. Remove manual parent traversal

Example refactor:

```typescript
// Before
export async function mintCommand(
  recipient: string,
  amount: string,
  opts: any,
) {
  const keypair = opts.keypair;
  const url = opts.url;
  // ...
}

// After
export async function mintCommand(
  recipient: string,
  amount: string,
  opts: any,
  cmd: Command,
) {
  const globalOpts = getGlobalOptions(cmd);
  const allOpts = mergeOptions(globalOpts, opts);
  // Use allOpts.keypair, allOpts.url, etc.
}
```

## Build Verification

### Build Process

1. Build SDK first: `cd sdk && npm install && npm run build`
2. Build CLI: `cd cli && npm install && npm run build`

### Verified Working

- ✅ SDK builds successfully
- ✅ CLI builds successfully
- ✅ TypeScript compilation passes
- ✅ All imports resolve correctly

### Known Issues Fixed

- Fixed `stable.mint()` → `stable.mintTokens()` method name
- All other SDK method calls verified correct

## Future Improvements

### 1. Type Safety

Replace `opts: any` with proper TypeScript interfaces:

```typescript
interface MintCommandOptions extends GlobalOptions {
  minter?: string;
}

export async function mintCommand(
  recipient: string,
  amount: string,
  opts: MintCommandOptions,
): Promise<void>;
```

### 2. Error Handling

Centralize error handling patterns:

```typescript
// cli/src/error-handler.ts
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  spinner: Ora,
  errorMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (err: any) {
    spinner.fail(errorMessage);
    display.error(err.message || err);
    process.exit(1);
  }
}
```

### 3. Testing

Add integration tests that verify:

- CLI commands parse correctly
- Global options propagate properly
- SDK methods are called with correct parameters

### 4. Configuration Management

Consider using a configuration library like `cosmiconfig` for more flexible config file discovery and merging.
