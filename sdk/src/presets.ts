// sdk/src/presets.ts
//
// Opinionated preset configurations for common stablecoin architectures.
//
// SSS-1: Minimal — mint + freeze + metadata. For internal tokens, DAOs.
// SSS-2: Compliant — SSS-1 + permanent delegate + transfer hook + blacklist.
//        For regulated stablecoins (USDC/USDT-class).

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
export const Presets: Record<"SSS_1" | "SSS_2", Readonly<StablecoinFeatures>> = {
  /**
   * SSS-1: Minimal Stablecoin
   *
   * Extensions: MetadataPointer + TokenMetadata
   * Use cases: internal tokens, DAO treasuries, ecosystem settlement
   * Compliance: reactive (freeze accounts individually as needed)
   */
  SSS_1: {
    enablePermanentDelegate: false,
    enableTransferHook: false,
    defaultAccountFrozen: false,
  },

  /**
   * SSS-2: Compliant Stablecoin
   *
   * Extensions: SSS-1 + PermanentDelegate + TransferHook + (optional DefaultAccountState)
   * Use cases: regulated stablecoins, GENIUS Act compliant tokens
   * Compliance: proactive (blacklist enforcement on every transfer, seizure capability)
   */
  SSS_2: {
    enablePermanentDelegate: true,
    enableTransferHook: true,
    defaultAccountFrozen: false, // Can be overridden in create options
  },
} as const;

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
export function resolveFeatures(opts: StablecoinCreateOptions): StablecoinFeatures {
  if (opts.preset) {
    const base = { ...Presets[opts.preset] };
    // Allow overriding defaultAccountFrozen even with a preset
    if (opts.extensions?.defaultAccountFrozen !== undefined) {
      base.defaultAccountFrozen = opts.extensions.defaultAccountFrozen;
    }
    return base;
  }

  if (opts.extensions) {
    return {
      enablePermanentDelegate: opts.extensions.enablePermanentDelegate ?? false,
      enableTransferHook: opts.extensions.enableTransferHook ?? false,
      defaultAccountFrozen: opts.extensions.defaultAccountFrozen ?? false,
    };
  }

  // Default to SSS-1
  return { ...Presets.SSS_1 };
}

/**
 * Determine the preset label for a given feature set.
 * Used in event emissions and display.
 */
export function getPresetLabel(features: StablecoinFeatures): string {
  if (features.enablePermanentDelegate && features.enableTransferHook) {
    return "SSS-2";
  }
  if (!features.enablePermanentDelegate && !features.enableTransferHook) {
    return "SSS-1";
  }
  return "custom";
}
