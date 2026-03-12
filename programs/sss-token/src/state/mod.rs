// programs/sss-token/src/state/mod.rs
//
// Barrel module: re-exports all state account types.
//
// Usage from other files:
//   use crate::state::StablecoinConfig;
//   use crate::state::RoleManager;
//   use crate::state::BlacklistEntry;
//   use crate::state::MinterEntry;

pub mod stablecoin_config;
pub mod role_manager;
pub mod blacklist_entry;

pub use stablecoin_config::*;
pub use role_manager::*;
pub use blacklist_entry::*;
