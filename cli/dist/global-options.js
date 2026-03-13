"use strict";
// cli/src/global-options.ts
//
// Centralized global options handling for all CLI commands.
// This eliminates the brittle parent.opts() pattern scattered across commands.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalOptions = getGlobalOptions;
exports.mergeOptions = mergeOptions;
/**
 * Extract global options from a Commander command instance.
 * Walks up the parent chain to find the root program options.
 */
function getGlobalOptions(cmd) {
    let current = cmd;
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
function mergeOptions(globalOpts, commandOpts) {
    return {
        ...globalOpts,
        ...commandOpts,
    };
}
