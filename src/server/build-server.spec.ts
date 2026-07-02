import { describe, it, expect } from 'vitest';
import { buildServer } from './build-server.js';
import { loadConfig } from '../config.js';
import type { ContainmentReport } from '../containment/types.js';

function report(contained: boolean): ContainmentReport {
  return {
    contained,
    checks: {
      krokiHealth: contained ? 'pass' : 'fail',
      egressSelfCheck: contained ? 'pass' : 'fail',
      canaryRender: contained ? 'pass' : 'fail',
      krokiSafeMode: 'SECURE',
      publishedPorts: 'none',
    },
  };
}

async function toolNames(server: ReturnType<typeof buildServer>): Promise<string[]> {
  // McpServer keeps registered tools on an internal map; read it defensively for the test.
  const record = (server as unknown as { _registeredTools?: Record<string, unknown> })._registeredTools;
  return record ? Object.keys(record) : [];
}

describe('buildServer', () => {
  it('registers the render tool when contained', async () => {
    const server = buildServer(loadConfig(), report(true));
    const names = await toolNames(server);
    expect(names).toContain('render_diagram');
    expect(names).toContain('list_formats');
    expect(names).toContain('containment_status');
  });

  it('withholds the render tool when NOT contained (fail-closed)', async () => {
    const server = buildServer(loadConfig(), report(false));
    const names = await toolNames(server);
    expect(names).not.toContain('render_diagram');
    expect(names).toContain('containment_status');
  });
});
