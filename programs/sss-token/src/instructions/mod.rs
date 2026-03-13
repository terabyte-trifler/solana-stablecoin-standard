// programs/sss-token/src/instructions/mod.rs

pub mod initialize;
pub mod init_hook_accounts;
pub mod mint_tokens;
pub mod burn_tokens;
pub mod freeze_thaw;
pub mod pause_unpause;
pub mod update_minter;
pub mod update_roles;
pub mod transfer_authority;
pub mod add_to_blacklist;
pub mod remove_from_blacklist;
pub mod seize;

// Re-export everything from each module for Anchor's macro system
pub use initialize::*;
pub use init_hook_accounts::*;
pub use mint_tokens::*;
pub use burn_tokens::*;
pub use freeze_thaw::*;
pub use pause_unpause::*;
pub use update_minter::*;
pub use update_roles::*;
pub use transfer_authority::*;
pub use add_to_blacklist::*;
pub use remove_from_blacklist::*;
pub use seize::*;
