import { describe, expect, it } from 'vitest';
import { iconPathParts, isIconPath, isIconTag } from './path-grammar.js';

describe('isIconPath', () => {
  it.each(['AWSCommon.puml', 'Compute/Lambda.puml', 'Groups/VPC.puml', 'Storage/all.puml', 'Compute/EC2_Instance.puml'])(
    'accepts %s',
    (path) => {
      expect(isIconPath(path)).toBe(true);
    },
  );

  it.each([
    '../AWSCommon.puml',
    'Compute/../Lambda.puml',
    '/Compute/Lambda.puml',
    'Compute\\Lambda.puml',
    'Compute/Sub/Lambda.puml',
    'Compute/%2e%2e.puml',
    'Compute/Lambda.txt',
    'Compute/Lambda',
    'Compute-X/Lambda.puml',
    '',
  ])('rejects %j', (path) => {
    expect(isIconPath(path)).toBe(false);
  });
});

describe('isIconTag', () => {
  it.each(['v23.1', 'v18', 'v1.2.3'])('accepts %s', (tag) => {
    expect(isIconTag(tag)).toBe(true);
  });

  it.each(['23.1', 'v23.1-rc', 'v23..1', 'main', 'v23.1/../x'])('rejects %s', (tag) => {
    expect(isIconTag(tag)).toBe(false);
  });
});

describe('iconPathParts', () => {
  it('classifies root files as base with no category', () => {
    expect(iconPathParts('AWSCommon.puml')).toEqual({ kind: 'base', category: null, name: 'AWSCommon' });
  });

  it('classifies Groups/ files as group', () => {
    expect(iconPathParts('Groups/VPC.puml')).toEqual({ kind: 'group', category: 'Groups', name: 'VPC' });
  });

  it('classifies other category files as icon', () => {
    expect(iconPathParts('Compute/Lambda.puml')).toEqual({ kind: 'icon', category: 'Compute', name: 'Lambda' });
  });
});
