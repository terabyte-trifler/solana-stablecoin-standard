// cli/src/display.ts
//
// All CLI output formatting. Uses chalk for colors.
// Every command uses these helpers for consistent output.

import chalk from "chalk";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { formatAmount } from "./config";

/** Print a success message with checkmark. */
export function success(msg: string): void {
  console.log(chalk.green("✓") + " " + msg);
}

/** Print an error message with X. */
export function error(msg: string): void {
  console.error(chalk.red("✗") + " " + msg);
}

/** Print a warning message. */
export function warn(msg: string): void {
  console.log(chalk.yellow("⚠") + " " + msg);
}

/** Print an info message. */
export function info(msg: string): void {
  console.log(chalk.blue("ℹ") + " " + msg);
}

/** Print a transaction link. */
export function txLink(signature: string, cluster: string = "devnet"): void {
  const base = cluster === "mainnet-beta"
    ? "https://explorer.solana.com/tx/"
    : `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
  console.log(chalk.dim("  tx: ") + chalk.cyan(base));
}

/** Print a labeled value. */
export function field(label: string, value: string | number | boolean): void {
  const formattedLabel = chalk.dim(label.padEnd(28));
  const formattedValue =
    typeof value === "boolean"
      ? value
        ? chalk.green("yes")
        : chalk.dim("no")
      : String(value);
  console.log(`  ${formattedLabel} ${formattedValue}`);
}

/** Print a section header. */
export function header(title: string): void {
  console.log();
  console.log(chalk.bold.white(title));
  console.log(chalk.dim("─".repeat(50)));
}

/** Abbreviate a pubkey for display. */
export function shortKey(key: PublicKey | string): string {
  const str = typeof key === "string" ? key : key.toBase58();
  if (str.length <= 16) return str;
  return str.slice(0, 6) + "..." + str.slice(-4);
}

/** Format a token amount with commas and decimals. */
export function fmtAmount(amount: BN, decimals: number = 6): string {
  const readable = formatAmount(amount, decimals);
  // Add thousands separators to whole part
  const parts = readable.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/** Format a unix timestamp as a readable date. */
export function fmtTimestamp(unixSeconds: number | BN): string {
  const ts = typeof unixSeconds === "number" ? unixSeconds : unixSeconds.toNumber();
  if (ts === 0) return chalk.dim("never");
  return new Date(ts * 1000).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
}

/** Print a simple table with rows. */
export function table(headers: string[], rows: string[][]): void {
  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(
      h.length,
      ...rows.map((r) => (r[i] || "").length)
    )
  );

  // Header
  const headerRow = headers
    .map((h, i) => chalk.bold(h.padEnd(widths[i])))
    .join("  ");
  console.log(`  ${headerRow}`);
  console.log(
    `  ${widths.map((w) => chalk.dim("─".repeat(w))).join("  ")}`
  );

  // Rows
  for (const row of rows) {
    const formattedRow = row
      .map((cell, i) => (cell || "").padEnd(widths[i]))
      .join("  ");
    console.log(`  ${formattedRow}`);
  }
}

/** Create an ora-compatible spinner. Falls back to simple dots if ora unavailable. */
export function spinner(text: string): { succeed: (t?: string) => void; fail: (t?: string) => void; stop: () => void } {
  try {
    const ora = require("ora");
    return ora({ text, spinner: "dots" }).start();
  } catch {
    // Fallback if ora not installed
    process.stdout.write(chalk.dim(`  ${text}...`));
    return {
      succeed: (t?: string) => console.log(chalk.green(` ✓ ${t || ""}`)),
      fail: (t?: string) => console.log(chalk.red(` ✗ ${t || ""}`)),
      stop: () => console.log(),
    };
  }
}
