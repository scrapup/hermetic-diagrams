/** CLI subcommands. `serve` (default) attaches the MCP client's stdio to the gateway container. */
export type CliCommand = 'serve' | 'up' | 'down' | 'pull' | 'help';

const KNOWN: ReadonlySet<string> = new Set(['serve', 'up', 'down', 'pull', 'help']);

/**
 * Parse the CLI command from argv (after node + script). No command → `serve` (the MCP client
 * invokes the bin with no args). `--help`/`-h` → `help`. Unknown → `help`.
 */
export function parseCommand(argv: readonly string[]): CliCommand {
  const first = argv[0];
  if (first === undefined) return 'serve';
  if (first === '--help' || first === '-h') return 'help';
  if (KNOWN.has(first)) return first as CliCommand;
  return 'help';
}
