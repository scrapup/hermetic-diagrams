import { describe, expect, it } from 'vitest';
import type { GuideCatalog } from '../../guides/guide-catalog.js';
import { parseGuide } from '../../guides/guide-catalog.js';
import { getAuthoringGuideResult, listAuthoringGuidesResult } from './authoring-guides.js';

const CATALOG: GuideCatalog = {
  awsIconsVersion: 'v23.1',
  guides: new Map([
    ['plantuml', parseGuide('plantuml', '# PlantUML\n\nSequence and more.\n')],
    ['aws-c4', parseGuide('aws-c4', '# AWS in C4\n\nC4 with icons.\n')],
  ]),
};

describe('list_authoring_guides', () => {
  it('lists id, title, summary and notation with the icon-set version', () => {
    expect(listAuthoringGuidesResult(CATALOG).structuredContent).toEqual({
      awsIconsVersion: 'v23.1',
      guides: [
        { id: 'plantuml', title: 'PlantUML', summary: 'Sequence and more.', notation: 'plantuml' },
        { id: 'aws-c4', title: 'AWS in C4', summary: 'C4 with icons.', notation: 'c4' },
      ],
    });
  });
});

describe('get_authoring_guide', () => {
  it('returns the guide markdown', () => {
    const result = getAuthoringGuideResult(CATALOG, 'aws-c4');
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ id: 'aws-c4', title: 'AWS in C4', markdown: '# AWS in C4\n\nC4 with icons.\n' });
  });

  it.each(['mermaid', 'aws-dark', '../plantuml', ''])('refuses %j with UNKNOWN_GUIDE and the available ids', (id) => {
    const result = getAuthoringGuideResult(CATALOG, id);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { code: 'UNKNOWN_GUIDE', detail: 'available: plantuml, aws-c4' },
    });
  });
});
