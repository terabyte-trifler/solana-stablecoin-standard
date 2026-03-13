#!/usr/bin/env node
"use strict";
// cli/src/index.ts
//
// ┌──────────────────────────────────────────────────────────────────┐
// │                    sss-token CLI                                 │
// │                                                                  │
// │  Admin CLI for the Solana Stablecoin Standard.                  │
// │  Operators use this to create, manage, and monitor stablecoins. │
// │                                                                  │
// │  Global options (apply to all commands):                         │
// │    --keypair <path>   Signer keypair (default: Solana CLI)      │
// │    --url <url>        RPC URL or cluster name                   │
// │    --config <pubkey>  StablecoinConfig PDA (default: active)    │
// └──────────────────────────────────────────────────────────────────┘
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
// Commands
const init_1 = require("./commands/init");
const operations_1 = require("./commands/operations");
const status_1 = require("./commands/status");
const minters_1 = require("./commands/minters");
const blacklist_1 = require("./commands/blacklist");
const audit_1 = require("./commands/audit");
const program = new commander_1.Command();
program
    .name("sss-token")
    .description("Solana Stablecoin Standard — Admin CLI")
    .version("0.1.0")
    // Global options inherited by all subcommands
    .option("-k, --keypair <path>", "path to signer keypair JSON")
    .option("-u, --url <url>", "Solana RPC URL or cluster (devnet/mainnet/localnet)")
    .option("-c, --config <pubkey>", "StablecoinConfig PDA address (overrides saved active)");
// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
program
    .command("init")
    .description("Create a new stablecoin")
    .option("-p, --preset <preset>", "use preset: sss-1 or sss-2", "sss-1")
    .option("--custom <file>", "use TOML config file for full customization")
    .option("-n, --name <name>", "token name")
    .option("-s, --symbol <symbol>", "token symbol")
    .option("-d, --decimals <decimals>", "decimal places (default: 6)")
    .option("--uri <uri>", "metadata URI")
    .action((opts) => {
    const globalOpts = program.opts();
    (0, init_1.initCommand)({ ...opts, keypair: globalOpts.keypair, url: globalOpts.url });
});
// ═══════════════════════════════════════════════════════════════
// TOKEN OPERATIONS
// ═══════════════════════════════════════════════════════════════
program
    .command("mint <recipient> <amount>")
    .description("Mint tokens to a recipient address")
    .option("--minter <path>", "minter keypair (default: signer keypair)")
    .action((recipient, amount, opts) => {
    const g = program.opts();
    (0, operations_1.mintCommand)(recipient, amount, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
program
    .command("burn <amount>")
    .description("Burn tokens from your token account")
    .action((amount, opts) => {
    const g = program.opts();
    (0, operations_1.burnCommand)(amount, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
program
    .command("freeze <token-account>")
    .description("Freeze a token account (master authority only)")
    .action((address, opts) => {
    const g = program.opts();
    (0, operations_1.freezeCommand)(address, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
program
    .command("thaw <token-account>")
    .description("Thaw a frozen token account (master authority only)")
    .action((address, opts) => {
    const g = program.opts();
    (0, operations_1.thawCommand)(address, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
program
    .command("pause")
    .description("Pause all mint/burn operations")
    .action((opts) => {
    const g = program.opts();
    (0, operations_1.pauseCommand)({ ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
program
    .command("unpause")
    .description("Resume operations (master authority only)")
    .action((opts) => {
    const g = program.opts();
    (0, operations_1.unpauseCommand)({ ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
// ═══════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════
program
    .command("status")
    .description("Show stablecoin configuration and status")
    .action((opts) => {
    const g = program.opts();
    (0, status_1.statusCommand)({ ...opts, url: g.url, config: g.config });
});
program
    .command("supply")
    .description("Show total token supply")
    .action((opts) => {
    const g = program.opts();
    (0, status_1.supplyCommand)({ ...opts, url: g.url, config: g.config });
});
program
    .command("holders")
    .description("List all token holders")
    .option("--min-balance <amount>", "minimum balance filter")
    .action((opts) => {
    const g = program.opts();
    (0, status_1.holdersCommand)({ ...opts, url: g.url, config: g.config });
});
// ═══════════════════════════════════════════════════════════════
// MINTERS SUBCOMMAND
// ═══════════════════════════════════════════════════════════════
const minters = program
    .command("minters")
    .description("Manage minter roles");
minters
    .command("list")
    .description("List all minters with quotas")
    .action((opts) => {
    const g = program.opts();
    (0, minters_1.mintersListCommand)({ ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
minters
    .command("add <address>")
    .description("Add a new minter")
    .option("-q, --quota <amount>", "per-epoch mint quota (0 = unlimited)")
    .action((address, opts) => {
    const g = program.opts();
    (0, minters_1.mintersAddCommand)(address, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
minters
    .command("remove <address>")
    .description("Remove a minter")
    .action((address, opts) => {
    const g = program.opts();
    (0, minters_1.mintersRemoveCommand)(address, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
// ═══════════════════════════════════════════════════════════════
// BLACKLIST SUBCOMMAND (SSS-2)
// ═══════════════════════════════════════════════════════════════
const blacklist = program
    .command("blacklist")
    .description("Manage address blacklist (SSS-2 only)");
blacklist
    .command("add <address>")
    .description("Blacklist a wallet address")
    .requiredOption("-r, --reason <reason>", "compliance reason for blacklisting")
    .action((address, opts) => {
    const g = program.opts();
    (0, blacklist_1.blacklistAddCommand)(address, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
blacklist
    .command("remove <address>")
    .description("Remove a wallet from the blacklist")
    .action((address, opts) => {
    const g = program.opts();
    (0, blacklist_1.blacklistRemoveCommand)(address, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
blacklist
    .command("check <address>")
    .description("Check if a wallet address is blacklisted")
    .action((address, opts) => {
    const g = program.opts();
    (0, blacklist_1.blacklistCheckCommand)(address, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
blacklist
    .command("list")
    .description("List all blacklisted addresses")
    .action((opts) => {
    const g = program.opts();
    (0, blacklist_1.blacklistListCommand)({ ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
// ═══════════════════════════════════════════════════════════════
// SEIZE (SSS-2)
// ═══════════════════════════════════════════════════════════════
program
    .command("seize <source-token-account>")
    .description("Seize tokens via permanent delegate (SSS-2 only)")
    .requiredOption("--to <token-account>", "destination treasury token account")
    .requiredOption("--amount <amount>", "amount to seize")
    .action((address, opts) => {
    const g = program.opts();
    (0, blacklist_1.seizeCommand)(address, { ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
// ═══════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════
program
    .command("audit-log")
    .description("View on-chain audit trail")
    .option("-a, --action <type>", "filter by action: mint|burn|freeze|thaw|pause|blacklist|seize|role|authority")
    .option("-l, --limit <count>", "max events to fetch (default: 100)")
    .option("-e, --export <file>", "export audit log to JSON file")
    .action((opts) => {
    const g = program.opts();
    (0, audit_1.auditLogCommand)({ ...opts, keypair: g.keypair, url: g.url, config: g.config });
});
// ═══════════════════════════════════════════════════════════════
// PARSE & EXECUTE
// ═══════════════════════════════════════════════════════════════
program.parse(process.argv);
// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
