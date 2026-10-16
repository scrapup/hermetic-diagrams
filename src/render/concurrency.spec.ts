import { describe, it, expect } from 'vitest';
import { ConcurrencyGuard } from './concurrency.js';
import { HermeticError } from '../errors.js';

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Flush pending microtasks and one macrotask turn, so queued acquisitions settle. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('ConcurrencyGuard', () => {
  it('runs up to maxConcurrency tasks at once and queues the rest', async () => {
    const guard = new ConcurrencyGuard(2, 10);
    const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
    let started = 0;

    const runs = gates.map((g) =>
      guard.run(async () => {
        started++;
        await g.promise;
      }),
    );

    await flush();
    expect(started).toBe(2);
    expect(guard.activeCount).toBe(2);
    expect(guard.queuedCount).toBe(1);

    gates[0]!.resolve();
    await flush();
    expect(started).toBe(3);

    gates[1]!.resolve();
    gates[2]!.resolve();
    await Promise.all(runs);
    expect(guard.activeCount).toBe(0);
    expect(guard.queuedCount).toBe(0);
  });

  it('rejects with a clear error when the queue is full', async () => {
    const guard = new ConcurrencyGuard(1, 1);
    const g1 = deferred<void>();
    const g2 = deferred<void>();

    const r1 = guard.run(async () => {
      await g1.promise;
    }); // active
    const r2 = guard.run(async () => {
      await g2.promise;
    }); // queued (fills the queue)

    await expect(guard.run(async () => undefined)).rejects.toBeInstanceOf(HermeticError);

    g1.resolve();
    g2.resolve();
    await Promise.all([r1, r2]);
  });

  it('releases the slot even when the task throws', async () => {
    const guard = new ConcurrencyGuard(1, 1);
    await expect(
      guard.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(guard.activeCount).toBe(0);
    // A subsequent task still runs.
    await expect(guard.run(async () => 'ok')).resolves.toBe('ok');
  });
});
