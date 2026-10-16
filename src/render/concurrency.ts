import { HermeticError } from '../errors.js';

/**
 * Anti-DoS guard (`plan.md` §5.5): bounds how many renders run at once. Requests over the limit
 * queue behind a semaphore; if the queue itself is full, the request is rejected with a clear error
 * rather than letting the process accumulate unbounded work.
 */
export class ConcurrencyGuard {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrency: number,
    private readonly maxQueue: number = maxConcurrency * 8,
  ) {
    if (maxConcurrency < 1) throw new Error('maxConcurrency must be >= 1');
  }

  /** Number of tasks currently executing (for tests/introspection). */
  get activeCount(): number {
    return this.active;
  }

  /** Number of tasks waiting for a slot. */
  get queuedCount(): number {
    return this.queue.length;
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueue) {
      throw new HermeticError(
        'RENDER_ERROR',
        'The renderer is at capacity; too many concurrent requests. Retry shortly.',
      );
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  /** Run `task` under the concurrency limit. Always releases the slot, even on failure. */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}
