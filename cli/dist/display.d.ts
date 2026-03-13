import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
/** Print a success message with checkmark. */
export declare function success(msg: string): void;
/** Print an error message with X. */
export declare function error(msg: string): void;
/** Print a warning message. */
export declare function warn(msg: string): void;
/** Print an info message. */
export declare function info(msg: string): void;
/** Print a transaction link. */
export declare function txLink(signature: string, cluster?: string): void;
/** Print a labeled value. */
export declare function field(label: string, value: string | number | boolean): void;
/** Print a section header. */
export declare function header(title: string): void;
/** Abbreviate a pubkey for display. */
export declare function shortKey(key: PublicKey | string): string;
/** Format a token amount with commas and decimals. */
export declare function fmtAmount(amount: BN, decimals?: number): string;
/** Format a unix timestamp as a readable date. */
export declare function fmtTimestamp(unixSeconds: number | BN): string;
/** Print a simple table with rows. */
export declare function table(headers: string[], rows: string[][]): void;
/** Create an ora-compatible spinner. Falls back to simple dots if ora unavailable. */
export declare function spinner(text: string): {
    succeed: (t?: string) => void;
    fail: (t?: string) => void;
    stop: () => void;
};
