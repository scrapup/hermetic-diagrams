import { afterEach, describe, expect, it, vi } from 'vitest';
import { awsIconsRootFromEnv, expandedLimit, loadConfig } from './config.js';

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

describe('expandedLimit', () => {
  it('keeps a configured limit at or above the source limit', () => {
    expect(expandedLimit(1000, 1000)).toBe(1000);
    expect(expandedLimit(1000, 5000)).toBe(5000);
  });

  it('falls back to the 2 MiB default when configured below the source limit', () => {
    expect(expandedLimit(262_144, 1000)).toBe(2 * 1024 * 1024);
  });

  it('never falls back below the source limit itself', () => {
    expect(expandedLimit(4 * 1024 * 1024, 1000)).toBe(4 * 1024 * 1024);
  });
});

describe('loadConfig (AWS limits)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to 2 MiB expanded and 200 includes', () => {
    const config = loadConfig();
    expect(config.maxExpandedSourceBytes).toBe(2 * 1024 * 1024);
    expect(config.maxAwsIncludes).toBe(200);
  });

  it('reads MAX_EXPANDED_SOURCE_BYTES and MAX_AWS_INCLUDES', () => {
    vi.stubEnv('MAX_EXPANDED_SOURCE_BYTES', '3000000');
    vi.stubEnv('MAX_AWS_INCLUDES', '50');
    const config = loadConfig();
    expect(config.maxExpandedSourceBytes).toBe(3_000_000);
    expect(config.maxAwsIncludes).toBe(50);
  });

  it('rejects an expanded limit below MAX_SOURCE_BYTES', () => {
    vi.stubEnv('MAX_SOURCE_BYTES', '500000');
    vi.stubEnv('MAX_EXPANDED_SOURCE_BYTES', '100');
    expect(loadConfig().maxExpandedSourceBytes).toBe(2 * 1024 * 1024);
  });

  it.each(['0', '-5', 'abc'])('falls back to defaults for invalid MAX_AWS_INCLUDES=%s', (raw) => {
    vi.stubEnv('MAX_AWS_INCLUDES', raw);
    expect(loadConfig().maxAwsIncludes).toBe(200);
  });
});
