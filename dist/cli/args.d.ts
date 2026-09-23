/** CLI subcommands. `serve` (default) attaches the MCP client's stdio to the gateway container. */
export type CliCommand = 'serve' | 'up' | 'down' | 'pull' | 'help';
/**
 * Parse the CLI command from argv (after node + script). No command → `serve` (the MCP client
 * invokes the bin with no args). `--help`/`-h` → `help`. Unknown → `help`.
 */
export declare function parseCommand(argv: readonly string[]): CliCommand;
