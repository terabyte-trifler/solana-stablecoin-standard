// sdk/src/types.ts
//
// All public types for the @stbr/sss-token SDK.
// These mirror the on-chain account structs but use TypeScript-native types.

import { PublicKey, Keypair, TransactionSignature } from "@solana/web3.js";
import BN from "bn.js";

// ============================================================================
// PRESETS
// ============================================================================

/** Feature flags that determine which Token-2022 extensions are enabled. */
export interface StablecoinFeatures {
  /** Enable PermanentDelegate extension (required for seize/clawback). */
  enablePermanentDelegate: boolean;
  /** Enable TransferHook extension (required for blacklist enforcement). */
  enableTransferHook: boolean;
  /** Enable DefaultAccountState::Frozen (all new token accounts start frozen). */
  defaultAccountFrozen: boolean;
}

/** Options for creating a new stablecoin via `SolanaStablecoin.create()`. */
export interface StablecoinCreateOptions {
  /** Use a preset configuration. Overrides individual feature flags. */
  preset?: "SSS_1" | "SSS_2";

  /** Token name (1–32 bytes). Required. */
  name: string;
  /** Ticker symbol (1–10 bytes). Required. */
  symbol: string;
  /** Number of decimal places (0–9). Defaults to 6. */
  decimals?: number;
  /** Metadata URI (0–200 bytes). Defaults to empty string. */
  uri?: string;

  /**
   * The keypair that will become the master authority.
   * Also pays for account creation. Required.
   */
  authority: Keypair;

  /**
   * Custom feature overrides. Ignored if `preset` is set.
   * Defaults to SSS-1 features if neither preset nor extensions provided.
   */
  extensions?: Partial<StablecoinFeatures>;
}

// ============================================================================
// ON-CHAIN ACCOUNT MIRRORS
// ============================================================================

/** Deserialized StablecoinConfig account data. */
export interface StablecoinConfigAccount {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  mint: PublicKey;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  isPaused: boolean;
  totalSupply: BN;
  masterAuthority: PublicKey;
  pendingMasterAuthority: PublicKey | null;
  bump: number;
}

/** A single minter entry with quota tracking. */
export interface MinterEntry {
  address: PublicKey;
  /** Max tokens mintable per epoch. 0 = unlimited. */
  quota: BN;
  /** Tokens minted so far in the current epoch. */
  minted: BN;
  /** Solana epoch of the last quota reset. */
  lastResetEpoch: BN;
}

/** Deserialized RoleManager account data. */
export interface RoleManagerAccount {
  stablecoin: PublicKey;
  minters: MinterEntry[];
  burners: PublicKey[];
  pausers: PublicKey[];
  blacklisters: PublicKey[];
  seizers: PublicKey[];
  bump: number;
}

/** Deserialized BlacklistEntry account data. */
export interface BlacklistEntryAccount {
  stablecoin: PublicKey;
  address: PublicKey;
  reason: string;
  blacklistedAt: BN;
  blacklistedBy: PublicKey;
  bump: number;
}

// ============================================================================
// OPERATION PARAMETERS
// ============================================================================

/** Parameters for minting tokens. */
export interface MintParams {
  /** Recipient's token account (or wallet — SDK can resolve ATA). */
  recipient: PublicKey;
  /** Amount in smallest units (e.g., 1_000_000 = 1.0 for 6 decimals). */
  amount: BN;
  /** The minter or master authority signing. */
  minter: Keypair;
}

/** Parameters for burning tokens. */
export interface BurnParams {
  /** Amount to burn. */
  amount: BN;
  /** The burner signing. Must own the token account. */
  burner: Keypair;
  /** Token account to burn from. If not provided, uses burner's ATA. */
  tokenAccount?: PublicKey;
}

/** Parameters for seizing tokens (SSS-2 only). */
export interface SeizeParams {
  /** Token account to seize from. */
  from: PublicKey;
  /** Treasury/destination token account. */
  to: PublicKey;
  /** Amount to seize. */
  amount: BN;
  /** Seizer or master authority signing. */
  authority: Keypair;
}

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

/** Role types matching the on-chain RoleType enum. */
export enum RoleType {
  Burner = "burner",
  Pauser = "pauser",
  Blacklister = "blacklister",
  Seizer = "seizer",
}

// ============================================================================
// READ OPERATION RESULTS
// ============================================================================

/** Info about a token holder. */
export interface HolderInfo {
  /** Wallet owner address. */
  owner: PublicKey;
  /** Token account address. */
  tokenAccount: PublicKey;
  /** Balance in smallest units. */
  balance: BN;
  /** Whether the token account is frozen. */
  isFrozen: boolean;
}

// ============================================================================
// AUDIT / COMPLIANCE
// ============================================================================

/** Filters for querying the audit event log. */
export interface AuditLogFilters {
  /** Filter by event type. */
  eventType?:
    | "StablecoinInitialized"
    | "TokensMinted"
    | "TokensBurned"
    | "AccountFrozen"
    | "AccountThawed"
    | "StablecoinPaused"
    | "StablecoinUnpaused"
    | "AddressBlacklisted"
    | "AddressRemovedFromBlacklist"
    | "TokensSeized"
    | "MinterAdded"
    | "MinterRemoved"
    | "RoleGranted"
    | "RoleRevoked"
    | "AuthorityTransferProposed"
    | "AuthorityTransferAccepted";
  /** Only events after this slot. */
  afterSlot?: number;
  /** Only events before this slot. */
  beforeSlot?: number;
  /** Max events to return. */
  limit?: number;
}

/** A parsed on-chain event from the program's transaction logs. */
export interface AuditEvent {
  /** Event name (e.g., "TokensMinted"). */
  name: string;
  /** Parsed event data. */
  data: Record<string, unknown>;
  /** Transaction signature containing this event. */
  signature: string;
  /** Slot number. */
  slot: number;
  /** Block time (unix timestamp), if available. */
  blockTime: number | null;
}
