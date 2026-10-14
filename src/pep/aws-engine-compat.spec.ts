import { describe, expect, it } from 'vitest';
import { strictScan } from '../../scripts/aws-icons/vendored-scan.ts';
import { shippedIconSet } from '../../test/helpers/icon-sets.js';
import { AWS_ENGINE_SHIMS, withEngineShim } from './aws-engine-compat.js';
import { scanSecurity } from './security-scanner.js';

/** Which upstream helper each shim overrides, and the scaled call that makes it necessary. */
const OVERRIDES: Readonly<Record<string, { readonly definition: string; readonly scaledCall: string }>> = {
  'AWSCommon.puml': { definition: '!function $AWSGroupImg($service)', scaledCall: 'IMG", "0.5")' },
  'AWSExperimental.puml': {
    definition: '!procedure $AWSIconNote($service, $label="", $side="left")',
    scaledCall: 'IMG", "0.5")',
  },
};

describe('AWS engine compatibility shims (D-11)', () => {
  it('only targets the two upstream helpers that scale images', () => {
    expect([...AWS_ENGINE_SHIMS.keys()].sort()).toEqual(Object.keys(OVERRIDES).sort());
  });

  it.each(Object.entries(OVERRIDES))('%s still defines the helper with a scaled image (shim still needed)', async (path, o) => {
    const content = (await shippedIconSet()).files.get(path) ?? '';
    expect(content).toContain(o.definition);
    expect(content).toContain(o.scaledCall);
  });

  it.each([...AWS_ENGINE_SHIMS])('%s shim redefines the helper at scale 1', (path, shim) => {
    expect(shim).toContain(OVERRIDES[path]?.definition);
    expect(shim).not.toMatch(/"0\.5"|\{scale=/);
  });

  it.each([...AWS_ENGINE_SHIMS])('%s shim is a safe source (strict scan + scanSecurity)', (_path, shim) => {
    expect(strictScan(shim)).toEqual([]);
    expect(() => scanSecurity('plantuml', shim, 1_000_000)).not.toThrow();
  });

  it('appends the shim after the verified content, on its own line', () => {
    expect(withEngineShim('AWSCommon.puml', 'X')).toBe(`X\n${AWS_ENGINE_SHIMS.get('AWSCommon.puml')}`);
    expect(withEngineShim('AWSCommon.puml', 'X\n')).toBe(`X\n${AWS_ENGINE_SHIMS.get('AWSCommon.puml')}`);
  });

  it('leaves every other file untouched', () => {
    expect(withEngineShim('Compute/Lambda.puml', 'X')).toBe('X');
  });
});
