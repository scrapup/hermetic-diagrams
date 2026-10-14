import { describe, it, expect } from 'vitest';
import { listFormatsResult } from './list-formats.js';
import { containmentStatusResult } from './containment-status.js';
import { INPUT_FORMATS, OUTPUT_FORMATS } from '../../domain.js';
import type { ContainmentReport } from '../../containment/types.js';
import { UNVERIFIED_ICON_SET, verifiedIconSet } from '../../../test/helpers/icon-sets.js';

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

  it('mirrors the containment report', () => {
    const result = containmentStatusResult(report, verifiedIconSet({ 'AWSCommon.puml': '' }));
    expect(result.structuredContent).toMatchObject({ contained: true });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toMatchObject({
      checks: { egressSelfCheck: 'pass' },
    });
  });

  it('reports a verified AWS icon set', () => {
    const result = containmentStatusResult(report, verifiedIconSet({ 'AWSCommon.puml': '' }));
    expect(result.structuredContent).toMatchObject({ awsIcons: { state: 'verified', version: 'v23.1' } });
    expect(result.structuredContent?.awsIcons).not.toHaveProperty('reason');
  });

  it('reports an unverified icon set without affecting `contained` (D-06)', () => {
    const result = containmentStatusResult(report, UNVERIFIED_ICON_SET);
    expect(result.structuredContent).toMatchObject({
      contained: true,
      awsIcons: { state: 'unverified', version: 'v23.1', reason: 'hash_mismatch' },
    });
  });
});
