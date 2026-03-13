import { StablecoinFeatures, StablecoinCreateOptions } from "./types";
/**
 * Preset feature configurations.
 *
 * Usage:
 * ```ts
 * const stable = await SolanaStablecoin.create(connection, {
 *   preset: "SSS_2",
 *   name: "My USD",
 *   symbol: "MYUSD",
 *   authority: keypair,
 * });
 * ```
 */
export declare const Presets: Record<"SSS_1" | "SSS_2", Readonly<StablecoinFeatures>>;
/**
 * Resolve create options into a complete feature configuration.
 *
 * Priority:
 * 1. If `preset` is set, use that preset's features
 * 2. Else if `extensions` is set, merge with SSS-1 defaults
 * 3. Else use SSS-1 defaults
 *
 * @param opts - The user-provided create options
 * @returns Complete feature configuration
 */
export declare function resolveFeatures(opts: StablecoinCreateOptions): StablecoinFeatures;
/**
 * Determine the preset label for a given feature set.
 * Used in event emissions and display.
 */
export declare function getPresetLabel(features: StablecoinFeatures): string;
//# sourceMappingURL=presets.d.ts.map