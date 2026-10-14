import { describe, expect, it } from 'vitest';
import { UNVERIFIED_ICON_SET, verifiedIconSet } from '../../../test/helpers/icon-sets.js';
import { listAwsIconsResult } from './list-aws-icons.js';

const SET = verifiedIconSet({ 'AWSCommon.puml': '', 'Compute/Lambda.puml': '', 'Compute/EC2.puml': '' });

describe('list_aws_icons', () => {
  it('returns the catalog as structured content and JSON text', () => {
    const result = listAwsIconsResult(SET, { query: 'lambda' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ version: 'v23.1', returned: 1, icons: [{ name: 'Lambda' }] });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(result.structuredContent);
  });

  it('defaults the limit to 50', () => {
    const many = verifiedIconSet(Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`Compute/I${i}.puml`, ''])));
    expect(listAwsIconsResult(many, {}).structuredContent).toMatchObject({ matched: 60, returned: 50 });
  });

  it.each([
    [{ limit: 0 }, 'limit'],
    [{ limit: 201 }, 'limit'],
    [{ limit: 1.5 }, 'limit'],
    [{ query: '' }, 'query'],
    [{ query: 'x'.repeat(65) }, 'query'],
    [{ category: '   ' }, 'category'],
    [{ category: 'x'.repeat(65) }, 'category'],
  ])('refuses %j with INVALID_FORMAT naming the field', (args, field) => {
    const result = listAwsIconsResult(SET, args);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: 'INVALID_FORMAT' } });
    expect((result.structuredContent as { error: { detail: string } }).error.detail).toMatch(new RegExp(`^${field}: `));
  });

  it.each([[{ limit: 1 }], [{ limit: 200 }], [{ query: 'x'.repeat(64) }]])('accepts the boundary %j', (args) => {
    expect(listAwsIconsResult(SET, args).isError).toBeUndefined();
  });

  it('answers ICONS_UNAVAILABLE when the set is unverified', () => {
    const result = listAwsIconsResult(UNVERIFIED_ICON_SET, {});
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: 'ICONS_UNAVAILABLE' } });
  });
});
