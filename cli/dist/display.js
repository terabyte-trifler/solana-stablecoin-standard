"use strict";
// cli/src/display.ts
//
// All CLI output formatting. Uses chalk for colors.
// Every command uses these helpers for consistent output.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.error = error;
exports.warn = warn;
exports.info = info;
exports.txLink = txLink;
exports.field = field;
exports.header = header;
exports.shortKey = shortKey;
exports.fmtAmount = fmtAmount;
exports.fmtTimestamp = fmtTimestamp;
exports.table = table;
exports.spinner = spinner;
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("./config");
/** Print a success message with checkmark. */
function success(msg) {
    console.log(chalk_1.default.green("✓") + " " + msg);
}
/** Print an error message with X. */
function error(msg) {
    console.error(chalk_1.default.red("✗") + " " + msg);
}
/** Print a warning message. */
function warn(msg) {
    console.log(chalk_1.default.yellow("⚠") + " " + msg);
}
/** Print an info message. */
function info(msg) {
    console.log(chalk_1.default.blue("ℹ") + " " + msg);
}
/** Print a transaction link. */
function txLink(signature, cluster = "devnet") {
    const base = cluster === "mainnet-beta"
        ? "https://explorer.solana.com/tx/"
        : `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
    console.log(chalk_1.default.dim("  tx: ") + chalk_1.default.cyan(base));
}
/** Print a labeled value. */
function field(label, value) {
    const formattedLabel = chalk_1.default.dim(label.padEnd(28));
    const formattedValue = typeof value === "boolean"
        ? value
            ? chalk_1.default.green("yes")
            : chalk_1.default.dim("no")
        : String(value);
    console.log(`  ${formattedLabel} ${formattedValue}`);
}
/** Print a section header. */
function header(title) {
    console.log();
    console.log(chalk_1.default.bold.white(title));
    console.log(chalk_1.default.dim("─".repeat(50)));
}
/** Abbreviate a pubkey for display. */
function shortKey(key) {
    const str = typeof key === "string" ? key : key.toBase58();
    if (str.length <= 16)
        return str;
    return str.slice(0, 6) + "..." + str.slice(-4);
}
/** Format a token amount with commas and decimals. */
function fmtAmount(amount, decimals = 6) {
    const readable = (0, config_1.formatAmount)(amount, decimals);
    // Add thousands separators to whole part
    const parts = readable.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}
/** Format a unix timestamp as a readable date. */
function fmtTimestamp(unixSeconds) {
    const ts = typeof unixSeconds === "number" ? unixSeconds : unixSeconds.toNumber();
    if (ts === 0)
        return chalk_1.default.dim("never");
    return new Date(ts * 1000).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
}
/** Print a simple table with rows. */
function table(headers, rows) {
    // Calculate column widths
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] || "").length)));
    // Header
    const headerRow = headers
        .map((h, i) => chalk_1.default.bold(h.padEnd(widths[i])))
        .join("  ");
    console.log(`  ${headerRow}`);
    console.log(`  ${widths.map((w) => chalk_1.default.dim("─".repeat(w))).join("  ")}`);
    // Rows
    for (const row of rows) {
        const formattedRow = row
            .map((cell, i) => (cell || "").padEnd(widths[i]))
            .join("  ");
        console.log(`  ${formattedRow}`);
    }
}
/** Create an ora-compatible spinner. Falls back to simple dots if ora unavailable. */
function spinner(text) {
    try {
        const ora = require("ora");
        return ora({ text, spinner: "dots" }).start();
    }
    catch {
        // Fallback if ora not installed
        process.stdout.write(chalk_1.default.dim(`  ${text}...`));
        return {
            succeed: (t) => console.log(chalk_1.default.green(` ✓ ${t || ""}`)),
            fail: (t) => console.log(chalk_1.default.red(` ✗ ${t || ""}`)),
            stop: () => console.log(),
        };
    }
}
