import { describe, it, expect } from 'vitest';
import { egressSelfCheck } from './egress-check.js';
import { loadConfig } from '../config.js';

const config = loadConfig();

describe('egressSelfCheck', () => {
  it('reports NOT contained (pass=false) when the connect succeeds', async () => {
    const result = await egressSelfCheck(config, async () => true);
    expect(result.pass).toBe(false);
    expect(result.name).toBe('egressSelfCheck');
  });

  it('reports contained (pass=true) when the connect fails/times out', async () => {
    const result = await egressSelfCheck(config, async () => false);
    expect(result.pass).toBe(true);
  });

  it('passes the configured host/port/timeout to the probe', async () => {
    let seen: [string, number, number] | undefined;
    await egressSelfCheck(config, async (host, port, timeout) => {
      seen = [host, port, timeout];
      return false;
    });
    expect(seen).toEqual([config.egressCheckHost, config.egressCheckPort, config.egressCheckTimeoutMs]);
  });
});
