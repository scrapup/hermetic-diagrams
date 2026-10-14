import { afterEach, describe, expect, it, vi } from 'vitest';
import { awsIconsRootFromEnv, loadConfig } from './config.js';

describe('awsIconsRootFromEnv', () => {
  it.each([[undefined], [''], ['  ']])('defaults to /app/assets/aws-icons for %j', (raw) => {
    expect(awsIconsRootFromEnv(raw)).toBe('/app/assets/aws-icons');
  });

  it.each(['/app/assets/aws-icons', '/app/assets/icons-alt', '/app/assets'])('accepts %s inside /app/assets', (raw) => {
    expect(awsIconsRootFromEnv(raw)).toBe(raw);
  });

  it.each([
    '/etc',
    '/app',
    '/app/assets-evil',
    '/app/assets/../secrets',
    '/app/assets/aws-icons/../../dist',
    'assets/aws-icons',
    '../aws-icons',
  ])('falls back to the default for %s', (raw) => {
    expect(awsIconsRootFromEnv(raw)).toBe('/app/assets/aws-icons');
  });

  it('normalizes a path inside /app/assets', () => {
    expect(awsIconsRootFromEnv('/app/assets/x/../aws-icons/')).toBe('/app/assets/aws-icons');
  });
});

describe('loadConfig (icon set)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads AWS_ICONS_ROOT with confinement and pins the lock path', () => {
    vi.stubEnv('AWS_ICONS_ROOT', '/tmp/evil');
    const config = loadConfig();
    expect(config.awsIconsRoot).toBe('/app/assets/aws-icons');
    expect(config.awsIconsLockPath).toBe('/app/aws-icons.lock.json');
  });
});
