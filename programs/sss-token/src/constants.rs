// programs/sss-token/src/constants.rs
//
// WHY THIS FILE EXISTS:
// On Solana, every account has a fixed size allocated at creation time.
// You can never grow an account after init (without realloc, which is expensive
// and fragile). So we must define maximum sizes for every variable-length field
// (Strings, Vecs) and compute the exact byte count each account needs.
//
// Anchor adds an 8-byte discriminator to every account (a hash of the account
// struct name, used to identify the account type). We must include that too.

// ============================================================================
// SEED CONSTANTS
// ============================================================================
// PDA seeds are the byte strings used to derive Program Derived Addresses.
// We define them as constants so we never typo a seed string across files.

/// Seed for StablecoinConfig PDA: ["stablecoin", mint_pubkey]
pub const STABLECOIN_SEED: &[u8] = b"stablecoin";

/// Seed for RoleManager PDA: ["roles", stablecoin_config_pubkey]
pub const ROLES_SEED: &[u8] = b"roles";

/// Seed for BlacklistEntry PDA: ["blacklist", stablecoin_config_pubkey, target_wallet_pubkey]
/// NOTE: We blacklist WALLET OWNER addresses, not individual token accounts.
/// Rationale: A wallet owner can create unlimited token accounts. Blacklisting
/// by owner covers all of them. The transfer hook resolves the owner from the
/// token account during enforcement.
pub const BLACKLIST_SEED: &[u8] = b"blacklist";

/// Seed for the ExtraAccountMetaList PDA in the transfer hook program.
/// Standard seed defined by the spl-transfer-hook-interface.
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";

/// The program ID of the sss-transfer-hook program.
/// Used when initializing the TransferHook extension on the mint.
/// REPLACE this with the actual deployed program ID.
///
/// To generate a vanity address: `solana-keygen grind --starts-with SSSh:1`
/// The program ID of the sss-transfer-hook program.
/// Used when initializing the TransferHook extension on the mint.
pub const TRANSFER_HOOK_PROGRAM_ID: anchor_lang::prelude::Pubkey =
    anchor_lang::pubkey!("8RU51UBAQKVBRiAJCEsEUbq331ruTp7KF61ranWott1j");

// ============================================================================
// STRING FIELD MAX LENGTHS (in bytes, NOT characters)
// ============================================================================
// Anchor serializes String as: 4 bytes (length prefix) + N bytes (UTF-8 content).
// So a String with max 32 bytes of content costs 4 + 32 = 36 bytes on-chain.

/// Max bytes for stablecoin name (e.g., "USD Coin", "Tether USD")
pub const MAX_NAME_LEN: usize = 32;

/// Max bytes for ticker symbol (e.g., "USDC", "USDT", "MYUSD")
pub const MAX_SYMBOL_LEN: usize = 10;

/// Max bytes for metadata URI (Arweave/IPFS link to off-chain JSON metadata)
pub const MAX_URI_LEN: usize = 200;

/// Max bytes for blacklist reason (e.g., "OFAC SDN match", "Court order #12345")
pub const MAX_REASON_LEN: usize = 100;

// ============================================================================
// ROLE VECTOR LIMITS
// ============================================================================
// Vec<T> on Solana serializes as: 4 bytes (length prefix) + N * size_of(T).
// We cap every vector to prevent the account from exceeding Solana's 10MB limit
// and to keep rent costs predictable.
//
// These limits are ENFORCED in the instruction handlers — if someone tries to
// add a 21st minter, the instruction fails with RoleLimitExceeded.

/// Max number of minters (each has individual quotas)
pub const MAX_MINTERS: usize = 20;

/// Max number of burners
pub const MAX_BURNERS: usize = 10;

/// Max number of pausers (addresses allowed to pause/unpause)
pub const MAX_PAUSERS: usize = 10;

/// Max number of blacklisters (SSS-2 only — addresses allowed to manage blacklist)
pub const MAX_BLACKLISTERS: usize = 10;

/// Max number of seizers (SSS-2 only — addresses allowed to seize tokens)
pub const MAX_SEIZERS: usize = 10;

// ============================================================================
// ACCOUNT SIZE CALCULATIONS
// ============================================================================
//
// How Anchor account sizing works:
//
//   Total size = 8 (discriminator) + sum of all field sizes
//
// Field size reference:
//   bool      = 1 byte
//   u8        = 1 byte
//   u64       = 8 bytes
//   i64       = 8 bytes
//   Pubkey    = 32 bytes
//   Option<T> = 1 + size_of(T)   (1 byte for Some/None tag)
//   String    = 4 + max_content_bytes
//   Vec<T>    = 4 + (max_count * size_of_element)
//
// We compute each account's max size here so Anchor's `space` constraint
// knows how many lamports to charge for rent-exempt minimum.

/// Size of a single MinterEntry struct (no discriminator — it's embedded in Vec)
///   address:          32 bytes (Pubkey)
///   quota:             8 bytes (u64)
///   minted:            8 bytes (u64)
///   last_reset_epoch:  8 bytes (u64)
///   Total:            56 bytes
pub const MINTER_ENTRY_SIZE: usize = 32 + 8 + 8 + 8; // = 56

/// StablecoinConfig account size
///
///   discriminator:                      8
///   name (String):                      4 + 32  = 36
///   symbol (String):                    4 + 10  = 14
///   uri (String):                       4 + 200 = 204
///   decimals (u8):                      1
///   mint (Pubkey):                      32
///   enable_permanent_delegate (bool):   1
///   enable_transfer_hook (bool):        1
///   default_account_frozen (bool):      1
///   is_paused (bool):                   1
///   total_supply (u64):                 8
///   master_authority (Pubkey):          32
///   pending_master_authority (Option):  1 + 32 = 33
///   bump (u8):                          1
///   ────────────────────────────────────────
///   Total:                              373
///
///   We round up to 384 for future-proofing (adding a small field won't
///   require migration). Never cut it exact — leave a buffer.
pub const STABLECOIN_CONFIG_SIZE: usize = 8  // discriminator
    + (4 + MAX_NAME_LEN)                     // name
    + (4 + MAX_SYMBOL_LEN)                   // symbol
    + (4 + MAX_URI_LEN)                      // uri
    + 1                                      // decimals
    + 32                                     // mint
    + 1                                      // enable_permanent_delegate
    + 1                                      // enable_transfer_hook
    + 1                                      // default_account_frozen
    + 1                                      // is_paused
    + 8                                      // total_supply
    + 32                                     // master_authority
    + (1 + 32)                               // pending_master_authority (Option<Pubkey>)
    + 1                                      // bump
    + 16;                                    // padding for future fields

/// RoleManager account size
///
///   discriminator:     8
///   stablecoin:        32     (Pubkey)
///   minters (Vec):     4 + (20 * 56) = 1124
///   burners (Vec):     4 + (10 * 32) = 324
///   pausers (Vec):     4 + (10 * 32) = 324
///   blacklisters:      4 + (10 * 32) = 324
///   seizers:           4 + (10 * 32) = 324
///   bump:              1
///   ────────────────────────────────────────
///   Total:             2461
///
///   Round up to 2500.
pub const ROLE_MANAGER_SIZE: usize = 8       // discriminator
    + 32                                     // stablecoin
    + (4 + MAX_MINTERS * MINTER_ENTRY_SIZE)  // minters
    + (4 + MAX_BURNERS * 32)                 // burners
    + (4 + MAX_PAUSERS * 32)                 // pausers
    + (4 + MAX_BLACKLISTERS * 32)            // blacklisters
    + (4 + MAX_SEIZERS * 32)                 // seizers
    + 1                                      // bump
    + 32;                                    // padding

/// BlacklistEntry account size
///
///   discriminator:     8
///   stablecoin:        32
///   address:           32
///   reason (String):   4 + 100 = 104
///   blacklisted_at:    8     (i64)
///   blacklisted_by:    32
///   bump:              1
///   ────────────────────────────────────────
///   Total:             217
///
///   Round up to 232.
pub const BLACKLIST_ENTRY_SIZE: usize = 8    // discriminator
    + 32                                     // stablecoin
    + 32                                     // address
    + (4 + MAX_REASON_LEN)                   // reason
    + 8                                      // blacklisted_at
    + 32                                     // blacklisted_by
    + 1                                      // bump
    + 16;                                    // padding
