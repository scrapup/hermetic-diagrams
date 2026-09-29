import { describe, it, expect } from 'vitest';
import { listFormatsResult } from './list-formats.js';
import { containmentStatusResult } from './containment-status.js';
import { INPUT_FORMATS, OUTPUT_FORMATS } from '../../domain.js';
import type { ContainmentReport } from '../../containment/types.js';

describe('list_formats', () => {
  it('returns the input and output allowlists', () => {
    const result = listFormatsResult();
    expect(result.structuredContent).toEqual({
      input: [...INPUT_FORMATS],
      output: [...OUTPUT_FORMATS],
    });
  });
});

describe('containment_status', () => {
  it('mirrors the containment report', () => {
    const report: ContainmentReport = {
      contained: true,
      checks: {
        krokiHealth: 'pass',
        egressSelfCheck: 'pass',
        canaryRender: 'pass',
        krokiSafeMode: 'SECURE',
        publishedPorts: 'none',
      },
    };
    const result = containmentStatusResult(report);
    expect(result.structuredContent).toMatchObject({ contained: true });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toMatchObject({
      checks: { egressSelfCheck: 'pass' },
    });
  });
});
