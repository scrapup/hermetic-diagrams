import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXIT_SPAWN_ERROR,
  EXIT_TIMEOUT,
  captureProcess,
  runProcess,
  type Spawn,
} from './docker-runner.js';

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly kill = vi.fn(() => true);
}

function fakeSpawn(child: FakeChild): { spawn: Spawn; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const spawn = ((...args: unknown[]) => {
    calls.push(args);
    return child as unknown as ChildProcess;
  }) as unknown as Spawn;
  return { spawn, calls };
}

const ENV = { HD_VERSION: '1.2.3' };

describe('runProcess', () => {
  it('resolves the child exit code and forwards command, args, stdio and env', async () => {
    const child = new FakeChild();
    const { spawn, calls } = fakeSpawn(child);

    const pending = runProcess('docker', ['compose', 'up'], { stdio: 'inherit', env: ENV }, spawn);
    child.emit('close', 3);

    expect(await pending).toBe(3);
    expect(calls[0]).toEqual(['docker', ['compose', 'up'], { stdio: 'inherit', env: ENV }]);
  });

  it('maps a null exit code (killed by signal) to 1', async () => {
    const child = new FakeChild();
    const { spawn } = fakeSpawn(child);

    const pending = runProcess('docker', [], { stdio: 'inherit', env: ENV }, spawn);
    child.emit('close', null);

    expect(await pending).toBe(1);
  });

  it('resolves 127 when the process cannot be spawned', async () => {
    const child = new FakeChild();
    const { spawn } = fakeSpawn(child);

    const pending = runProcess('docker', [], { stdio: 'inherit', env: ENV }, spawn);
    child.emit('error', new Error('ENOENT'));

    expect(await pending).toBe(EXIT_SPAWN_ERROR);
  });

  it('ignores a close that follows an error (settles once)', async () => {
    const child = new FakeChild();
    const { spawn } = fakeSpawn(child);

    const pending = runProcess('docker', [], { stdio: 'inherit', env: ENV }, spawn);
    child.emit('error', new Error('ENOENT'));
    child.emit('close', 0);

    expect(await pending).toBe(EXIT_SPAWN_ERROR);
  });
});

describe('captureProcess', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns stdout, pipes only stdout and clears the timer on close', async () => {
    const child = new FakeChild();
    const { spawn, calls } = fakeSpawn(child);

    const pending = captureProcess('docker', ['info'], { env: ENV, timeoutMs: 1_000 }, spawn);
    child.stdout.write('linux\n');
    await vi.advanceTimersByTimeAsync(0);
    child.emit('close', 0);

    expect(await pending).toEqual({ code: 0, stdout: 'linux\n', timedOut: false });
    expect(calls[0]?.[2]).toEqual({ stdio: ['ignore', 'pipe', 'ignore'], env: ENV });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('kills the child and resolves 124 when the timeout expires', async () => {
    const child = new FakeChild();
    const { spawn } = fakeSpawn(child);

    const pending = captureProcess('docker', ['info'], { env: ENV, timeoutMs: 1_000 }, spawn);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toEqual({ code: EXIT_TIMEOUT, stdout: '', timedOut: true });
    expect(child.kill).toHaveBeenCalledOnce();
  });

  it('does not time out before the deadline', async () => {
    const child = new FakeChild();
    const { spawn } = fakeSpawn(child);

    const pending = captureProcess('docker', ['info'], { env: ENV, timeoutMs: 1_000 }, spawn);
    await vi.advanceTimersByTimeAsync(999);
    child.emit('close', 0);

    expect((await pending).timedOut).toBe(false);
    expect(child.kill).not.toHaveBeenCalled();
  });
});
