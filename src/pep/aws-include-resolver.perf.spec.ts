import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shippedIconSet } from '../../test/helpers/icon-sets.js';
import { loadIconSet } from '../aws/icon-set-store.js';
import { loadConfig } from '../config.js';
import { resolveAwsIncludes } from './aws-include-resolver.js';
import { scanSecurity } from './security-scanner.js';

/**
 * Substitution overhead SLA (aws-icons spec §5, plan §7): P95 < 50 ms for a diagram with 50 distinct
 * `AWSPuml/` includes, measured over 200 runs of resolve + the scan of the expanded source (what the
 * pipeline adds). Runs in the `perf` vitest project (`npm run test:perf`), outside the coverage gate.
 */

const RUNS = 200;
const P95_BUDGET_MS = 50;

describe('AWS include resolver performance', () => {
  it(`resolves 50 includes with P95 < ${P95_BUDGET_MS} ms over ${RUNS} runs`, async () => {
    const set = await shippedIconSet();
    const icons = [...set.files.keys()].filter((p) => p.includes('/') && !p.startsWith('Groups/')).slice(0, 49);
    const source = ['@startuml', '!include AWSPuml/AWSCommon.puml', ...icons.map((p) => `!include AWSPuml/${p}`), '@enduml'].join(
      '\n',
    );
    const config = loadConfig();

    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const started = performance.now();
      const resolved = resolveAwsIncludes('plantuml', source, set, config);
      scanSecurity('plantuml', resolved.source, config.maxExpandedSourceBytes, 'expanded');
      samples.push(performance.now() - started);
      expect(resolved.includes).toBe(50);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(RUNS * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
    console.log(`aws-include-resolver perf: 50 includes, P95 ${p95.toFixed(2)} ms, median ${(samples[RUNS / 2] ?? 0).toFixed(2)} ms`);
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});

describe('Icon Set Store boot performance', () => {
  it('verifies the shipped set (831 files) in under 2 s', async () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const started = performance.now();
    const set = await loadIconSet(path.join(root, 'assets', 'aws-icons'), path.join(root, 'aws-icons.lock.json'));
    const durationMs = performance.now() - started;
    console.log(`icon-set-store boot: ${set.files.size} files in ${durationMs.toFixed(1)} ms`);
    expect(set.state).toBe('VERIFIED');
    expect(durationMs).toBeLessThan(2_000);
  });
});
