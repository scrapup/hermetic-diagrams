import { describe, expect, it } from 'vitest';
import { shippedIconSet, verifiedIconSet } from '../../test/helpers/icon-sets.js';
import { macrosFor, searchIcons } from './icon-catalog.js';

const SET = verifiedIconSet({
  'AWSSimplified.puml': '',
  'AWSCommon.puml': '',
  'AWSC4Integration.puml': '',
  'Storage/SimpleStorageService.puml': '',
  'Storage/Backup.puml': '',
  'Compute/Lambda.puml': '',
  'Compute/EC2.puml': '',
  'Groups/VPC.puml': '',
});

describe('searchIcons', () => {
  it('returns every icon and group sorted by category then name, with base includes', () => {
    const result = searchIcons(SET, { limit: 50 });
    expect(result).toEqual({
      version: 'v23.1',
      total: 5,
      matched: 5,
      returned: 5,
      categories: ['Compute', 'Groups', 'Storage'],
      icons: [
        {
          category: 'Compute',
          name: 'EC2',
          include: '!include AWSPuml/Compute/EC2.puml',
          macros: ['EC2(alias, label, technology)', 'EC2Participant(alias, label, technology)'],
        },
        {
          category: 'Compute',
          name: 'Lambda',
          include: '!include AWSPuml/Compute/Lambda.puml',
          macros: ['Lambda(alias, label, technology)', 'LambdaParticipant(alias, label, technology)'],
        },
        { category: 'Groups', name: 'VPC', include: '!include AWSPuml/Groups/VPC.puml', macros: ['VPCGroup(alias, label)'] },
        {
          category: 'Storage',
          name: 'Backup',
          include: '!include AWSPuml/Storage/Backup.puml',
          macros: ['Backup(alias, label, technology)', 'BackupParticipant(alias, label, technology)'],
        },
        {
          category: 'Storage',
          name: 'SimpleStorageService',
          include: '!include AWSPuml/Storage/SimpleStorageService.puml',
          macros: [
            'SimpleStorageService(alias, label, technology)',
            'SimpleStorageServiceParticipant(alias, label, technology)',
          ],
        },
      ],
      base: [
        '!include AWSPuml/AWSCommon.puml',
        '!include AWSPuml/AWSC4Integration.puml',
        '!include AWSPuml/AWSSimplified.puml',
      ],
    });
  });

  it('filters by category, case-insensitively and exactly', () => {
    expect(searchIcons(SET, { category: 'storage', limit: 50 }).icons.map((i) => i.name)).toEqual([
      'Backup',
      'SimpleStorageService',
    ]);
    expect(searchIcons(SET, { category: 'Stor', limit: 50 }).returned).toBe(0);
  });

  it('filters by a case-insensitive name substring', () => {
    expect(searchIcons(SET, { query: 'STORAGE', limit: 50 }).icons.map((i) => i.name)).toEqual(['SimpleStorageService']);
  });

  it('combines category and query', () => {
    expect(searchIcons(SET, { category: 'Compute', query: 'c2', limit: 50 }).icons.map((i) => i.name)).toEqual(['EC2']);
  });

  it('applies the limit after sorting and reports matched vs returned', () => {
    const result = searchIcons(SET, { limit: 2 });
    expect(result).toMatchObject({ total: 5, matched: 5, returned: 2 });
    expect(result.icons.map((i) => i.name)).toEqual(['EC2', 'Lambda']);
  });

  it('returns an empty result (not an error) with the version when nothing matches', () => {
    expect(searchIcons(SET, { query: 'nothing-like-this', limit: 50 })).toMatchObject({
      version: 'v23.1',
      matched: 0,
      returned: 0,
      icons: [],
    });
  });
});

describe('macrosFor against the real shipped set', () => {
  it('derives macros that every shipped icon and group actually defines', async () => {
    const set = await shippedIconSet();
    const missing: string[] = [];
    for (const [category, paths] of set.categories) {
      for (const path of paths) {
        const name = path.slice(category.length + 1, -'.puml'.length);
        const content = set.files.get(path) ?? '';
        for (const macro of macrosFor(category, name)) {
          const macroName = macro.slice(0, macro.indexOf('('));
          if (!content.includes(`!define ${macroName}(`)) missing.push(`${path}: ${macroName}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('reports the real totals (799 icons + 27 groups)', async () => {
    const result = searchIcons(await shippedIconSet(), { limit: 1 });
    expect(result.total).toBe(826);
    expect(result.base[0]).toBe('!include AWSPuml/AWSCommon.puml');
    expect(result.base).toHaveLength(5);
  });
});
