import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IconSet } from '../../aws/icon-set-store.js';
import type { McpToolResult } from './render-diagram.js';
/**
 * `list_aws_icons` (aws-icons `plan.md` §4.2): offline discovery over the shipped AWS icon set.
 * Always registered; an unverified set answers `ICONS_UNAVAILABLE`. Inputs are typed loosely in the
 * schema so range violations produce the contract's `INVALID_FORMAT` (field + rule).
 */
export declare const LIST_AWS_ICONS_INPUT: {
    category: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
};
export interface ListAwsIconsArgs {
    category?: string | undefined;
    query?: string | undefined;
    limit?: number | undefined;
}
export declare function listAwsIconsResult(iconSet: IconSet, args: ListAwsIconsArgs): McpToolResult;
export declare function registerListAwsIcons(server: McpServer, iconSet: IconSet): void;
