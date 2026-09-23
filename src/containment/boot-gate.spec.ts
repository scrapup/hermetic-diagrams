import { describe, it, expect } from 'vitest';
import { runBootGate } from './boot-gate.js';
import { loadConfig } from '../config.js';
import type { CanaryDeps } from './canary-render.js';

const config = loadConfig();
const cleanCanary: CanaryDeps = {
  canaryUrl: 'http://sink.test/x',
  renderRaw: async () => '<svg>ok</svg>',
  wasSinkHit: () => false,
  sinkReachable: () => true,
};

describe('runBootGate', () => {
  it('is contained when health passes, egress is blocked, and the canary is clean', async () => {
    const report = await runBootGate({
      config,
      checkKrokiHealth: async () => true,
      egressProbe: async () => false, // no external route
      canary: cleanCanary,
    });
    expect(report.contained).toBe(true);
    expect(report.checks).toMatchObject({
      krokiHealth: 'pass',
      egressSelfCheck: 'pass',
      canaryRender: 'pass',
      krokiSafeMode: 'SECURE',
      publishedPorts: 'none',
    });
  });

  it('fails closed and skips downstream checks when Kroki is unhealthy', async () => {
    const report = await runBootGate({
      config,
      checkKrokiHealth: async () => false,
      egressProbe: async () => false,
      canary: cleanCanary,
    });
    expect(report.contained).toBe(false);
    expect(report.checks.krokiHealth).toBe('fail');
    expect(report.checks.egressSelfCheck).toBe('fail');
    expect(report.checks.canaryRender).toBe('fail');
  });

  it('is NOT contained when egress is reachable', async () => {
    const report = await runBootGate({
      config,
      checkKrokiHealth: async () => true,
      egressProbe: async () => true, // external route exists
      canary: cleanCanary,
    });
    expect(report.contained).toBe(false);
    expect(report.checks.egressSelfCheck).toBe('fail');
  });

  it('is NOT contained when the canary leaks', async () => {
    const report = await runBootGate({
      config,
      checkKrokiHealth: async () => true,
      egressProbe: async () => false,
      canary: {
        canaryUrl: 'http://sink.test/x',
        renderRaw: async () => '<svg>HERMETIC_CANARY_LEAK</svg>',
        wasSinkHit: () => false,
        sinkReachable: () => true,
      },
    });
    expect(report.contained).toBe(false);
    expect(report.checks.canaryRender).toBe('fail');
  });

  it('treats a throwing healthcheck as unhealthy', async () => {
    const report = await runBootGate({
      config,
      checkKrokiHealth: async () => {
        throw new Error('down');
      },
      canary: cleanCanary,
    });
    expect(report.contained).toBe(false);
    expect(report.checks.krokiHealth).toBe('fail');
  });
});
