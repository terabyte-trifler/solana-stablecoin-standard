# Architecture

## Three-Layer Model

The SSS architecture separates concerns into three layers. Each layer builds on the one below it.

### Layer 1 — Base SDK

The foundation: Token-2022 mint creation with configurable extensions, role-based access control, and the toolchain (CLI, TypeScript SDK, backend).

Components: mint creation with extension selection, role management program, event emission system.

### Layer 2 — Composable Modules

Independent, testable capabilities that add features to the base:

**Base Token Module** — mint, burn, freeze, thaw, pause/unpause. Available on all presets.

**Compliance Module** (SSS-2) — transfer hook program for blacklist enforcement, blacklist PDA management, permanent delegate for token seizure. Each piece is independently testable.

### Layer 3 — Standard Presets

Opinionated combinations of Layer 1 + Layer 2 that form the documented standards:

- **SSS-1** selects: Base Token Module only
- **SSS-2** selects: Base Token Module + full Compliance Module

## Programs

Two Anchor programs deployed on-chain:

**sss-token** — the main program. 18 instructions covering initialization, token operations, role management, authority transfer, and SSS-2 compliance features. All instructions live in one program; SSS-2 features are gated by config flags.

**sss-transfer-hook** — a separate program implementing the Token-2022 Transfer Hook Interface. Invoked automatically by Token-2022 on every `transfer_checked` call for SSS-2 mints. Checks sender and receiver wallet addresses against blacklist PDAs.

## Authority Model

```
┌─────────────────────────────────────────────────────┐
│  Human/Multisig (master_authority)                  │
│  Signs transactions to authorize operations         │
│  NEVER directly owns token authorities              │
│                                                      │
│         ↓ signs instructions to ↓                   │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  StablecoinConfig PDA (program-controlled)    │  │
│  │                                                │  │
│  │  • mint_authority on Token-2022 mint           │  │
│  │  • freeze_authority on Token-2022 mint         │  │
│  │  • permanent_delegate (SSS-2 only)             │  │
│  │  • transfer_hook authority (SSS-2 only)        │  │
│  │  • metadata update authority                   │  │
│  │                                                │  │
│  │  The program signs CPIs using this PDA.        │  │
│  │  No human key ever has direct token authority. │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

The master_authority governs the stablecoin through the program. The config PDA executes operations. This separation means even if the master_authority key is compromised, the attacker can only act through program-enforced rules (quotas, role checks, etc.).

## PDA Derivation

| Account | Seeds | Program |
|---------|-------|---------|
| StablecoinConfig | `["stablecoin", mint_pubkey]` | sss-token |
| RoleManager | `["roles", config_pda]` | sss-token |
| BlacklistEntry | `["blacklist", config_pda, wallet_owner]` | sss-token |
| ExtraAccountMetaList | `["extra-account-metas", mint_pubkey]` | sss-transfer-hook |

TypeScript derivation:

```typescript
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("stablecoin"), mint.toBuffer()],
  SSS_TOKEN_PROGRAM_ID
);
```

## Token-2022 Extension Init Order

Extensions must be initialized BEFORE `InitializeMint2`. Violating this order causes irrecoverable failure.

```
1. CreateAccount           — allocate space for mint + all extensions
2. InitPermanentDelegate   — (SSS-2) delegate = config PDA
3. InitTransferHook        — (SSS-2) hook_program = sss-transfer-hook
4. InitDefaultAccountState — (optional) frozen by default
5. InitMetadataPointer     — metadata address = the mint itself
6. InitializeMint2         — sets mint_authority + freeze_authority = config PDA
7. InitTokenMetadata       — writes name, symbol, uri
```

For SSS-2, the ExtraAccountMetaList must be initialized after the mint exists but before any transfers. This is done in a separate `init_hook_accounts` instruction.

## Transfer Hook Data Flow (SSS-2)

```
User calls transfer_checked on Token-2022 mint
    │
    ▼
Token-2022 processes base transfer
    │
    ▼
Token-2022 detects TransferHook extension on mint
    │
    ▼
Token-2022 reads ExtraAccountMetaList PDA
    │ resolves: sss-token program, config PDA,
    │           source blacklist PDA, dest blacklist PDA
    ▼
Token-2022 CPIs into sss-transfer-hook::execute
    │
    ▼
Hook checks: does source blacklist PDA have data?
    │   YES → reject transfer (AddressBlacklisted)
    │   NO  → continue
    ▼
Hook checks: does dest blacklist PDA have data?
    │   YES → reject transfer (AddressBlacklisted)
    │   NO  → allow transfer
    ▼
Transfer completes
```

Blacklist PDAs use an existence-based check: if the PDA account has data, the owner is blacklisted. No deserialization needed — just check `data_len() > 0`.

## Seize Data Flow (SSS-2)

```
Seizer signs seize instruction
    │
    ▼
sss-token validates: authority, feature flags, amount
    │
    ▼
sss-token builds transfer_checked CPI with:
  - base accounts: source, mint, dest, config PDA (as delegate)
  - remaining accounts: hook ExtraAccountMetaList + all extra metas
    │
    ▼
Token-2022 processes transfer with permanent delegate authority
    │
    ▼
Token-2022 invokes transfer hook (same flow as above)
    │
    ▼
Tokens moved from source → destination
```

The remaining accounts are critical: without them Token-2022 can't find the hook's extra accounts and fails with error `0xa261c2c0`.

## Pause Behavior Matrix

| Instruction | While Paused | Rationale |
|---|---|---|
| mint | BLOCKED | No new tokens during emergency |
| burn | BLOCKED | No destruction during emergency |
| freeze_account | ALLOWED | Emergency response needs freezing |
| thaw_account | ALLOWED | Correct freeze mistakes |
| add_to_blacklist | ALLOWED | Compliance never stops |
| remove_from_blacklist | ALLOWED | Compliance never stops |
| seize | ALLOWED | Enforcement never stops |
| pause | N/A (AlreadyPaused) | — |
| unpause | ALLOWED | Resume operations |
| transfer_authority | ALLOWED | Admin always works |
| accept_authority | ALLOWED | Admin always works |
| add/remove minter | ALLOWED | Admin always works |
| grant/revoke role | ALLOWED | Admin always works |

Token transfers between users are NOT affected by pause. Transfers go through Token-2022 directly. To halt transfers, freeze individual accounts.

## Account Sizes

| Account | Size (bytes) | Rent (~SOL) |
|---------|---|---|
| StablecoinConfig | 384 | ~0.003 |
| RoleManager | 2,500 | ~0.019 |
| BlacklistEntry | 232 | ~0.002 |

Sizes include 8-byte Anchor discriminator and padding for future fields.

## Security Model

**No single key controls everything.** The master authority manages roles, but individual operators (minters, pausers, blacklisters, seizers) have separate keys with limited permissions.

**Minter quotas** limit per-epoch minting. Even a compromised minter key can only mint up to its quota before being detected and removed.

**Two-step authority transfer** prevents accidental lockout. The new authority must explicitly accept.

**Pausers can pause but not unpause.** If a pauser key is compromised, the attacker can only pause (safe) — not unpause or perform other operations.

**Transfer hook is atomic.** Every transfer is checked against the blacklist as part of the Token-2022 transfer instruction. There's no window where a blacklisted address can slip through.

**Events form an immutable audit trail.** Even after a BlacklistEntry PDA is closed, the `AddressBlacklisted` and `AddressRemovedFromBlacklist` events persist in Solana's ledger permanently.
