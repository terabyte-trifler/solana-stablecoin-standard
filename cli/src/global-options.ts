// cli/src/global-options.ts
//
// Centralized global options handling for all CLI commands.
// This eliminates the brittle parent.opts() pattern scattered across commands.

import { Command } from "commander";

/**
 * Global options available to all commands.
 */
export interface GlobalOptions {
  keypair?: string;
  url?: string;
  config?: string;
}

/**
 * Extract global options from a Commander command instance.
 * Walks up the parent chain to find the root program options.
 */
export function getGlobalOptions(cmd: Command): GlobalOptions {
  let current: Command | null = cmd;

  // Walk up to the root program
  while (current.parent) {
    current = current.parent;
  }

  const opts = current.opts();
  return {
    keypair: opts.keypair,
    url: opts.url,
    config: opts.config,
  };
}

/**
 * Merge global options with command-specific options.
 * Command options take precedence over global options.
 */
export function mergeOptions<T extends Record<string, any>>(
  globalOpts: GlobalOptions,
  commandOpts: T,
): T & GlobalOptions {
  return {
    ...globalOpts,
    ...commandOpts,
  };
}
