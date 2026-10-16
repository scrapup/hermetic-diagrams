import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IconSet } from '../../aws/icon-set-store.js';
import { DEFAULT_ICON_LIMIT, MAX_ICON_LIMIT, MAX_QUERY_CHARS, searchIcons } from '../../aws/icon-catalog.js';
import { HermeticError } from '../../errors.js';
import { mapError } from '../error-mapper.js';
import type { McpToolResult } from './render-diagram.js';

/**
 * `list_aws_icons` (aws-icons `plan.md` §4.2): offline discovery over the shipped AWS icon set.
 * Always registered; an unverified set answers `ICONS_UNAVAILABLE`. Inputs are typed loosely in the
 * schema so range violations produce the contract's `INVALID_FORMAT` (field + rule).
 */

export const LIST_AWS_ICONS_INPUT = {
  category: z.string().optional().describe('Exact category name, case-insensitive (e.g. "Compute").'),
  query: z
    .string()
    .optional()
    .describe(`Case-insensitive substring of the icon name, 1..${MAX_QUERY_CHARS} characters.`),
  limit: z
    .number()
    .optional()
    .describe(`Max icons returned, integer 1..${MAX_ICON_LIMIT}; defaults to ${DEFAULT_ICON_LIMIT}.`),
};

export interface ListAwsIconsArgs {
  category?: string | undefined;
  query?: string | undefined;
  limit?: number | undefined;
}

function invalid(field: string, rule: string): HermeticError {
  return new HermeticError('INVALID_FORMAT', `Invalid "${field}" for list_aws_icons.`, `${field}: ${rule}`);
}

function validate(args: ListAwsIconsArgs): { category?: string; query?: string; limit: number } {
  const { category, query, limit } = args;
  if (category !== undefined && (category.trim() === '' || category.length > MAX_QUERY_CHARS)) {
    throw invalid('category', `must be 1..${MAX_QUERY_CHARS} characters`);
  }
  if (query !== undefined && (query.length === 0 || query.length > MAX_QUERY_CHARS)) {
    throw invalid('query', `must be 1..${MAX_QUERY_CHARS} characters`);
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_ICON_LIMIT)) {
    throw invalid('limit', `must be an integer 1..${MAX_ICON_LIMIT}`);
  }
  return {
    ...(category !== undefined ? { category: category.trim() } : {}),
    ...(query !== undefined ? { query } : {}),
    limit: limit ?? DEFAULT_ICON_LIMIT,
  };
}

function errorResult(err: unknown): McpToolResult {
  const mapped = mapError(err);
  return { content: [{ type: 'text', text: JSON.stringify(mapped) }], structuredContent: { ...mapped }, isError: true };
}

export function listAwsIconsResult(iconSet: IconSet, args: ListAwsIconsArgs): McpToolResult {
  try {
    const search = validate(args);
    if (iconSet.state !== 'VERIFIED') {
      throw new HermeticError(
        'ICONS_UNAVAILABLE',
        'AWS icons are unavailable: the shipped icon set failed its integrity check at startup.',
        'See containment_status.awsIcons.',
      );
    }
    const payload = searchIcons(iconSet, search);
    return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: { ...payload } };
  } catch (err) {
    return errorResult(err);
  }
}

export function registerListAwsIcons(server: McpServer, iconSet: IconSet): void {
  server.registerTool(
    'list_aws_icons',
    {
      title: 'List shipped AWS icons',
      description:
        'Search the AWS icon set shipped with this server (offline) by category and/or name. Returns the icon-set ' +
        'version, the exact `!include AWSPuml/...` line and the macros for each icon, plus the base includes ' +
        '(`AWSCommon.puml` must come first).',
      inputSchema: LIST_AWS_ICONS_INPUT,
    },
    (args) => listAwsIconsResult(iconSet, args),
  );
}
