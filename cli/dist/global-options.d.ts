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
export declare function getGlobalOptions(cmd: Command): GlobalOptions;
/**
 * Merge global options with command-specific options.
 * Command options take precedence over global options.
 */
export declare function mergeOptions<T extends Record<string, any>>(globalOpts: GlobalOptions, commandOpts: T): T & GlobalOptions;
