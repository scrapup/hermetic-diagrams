/**
 * Anti-DoS guard (`plan.md` §5.5): bounds how many renders run at once. Requests over the limit
 * queue behind a semaphore; if the queue itself is full, the request is rejected with a clear error
 * rather than letting the process accumulate unbounded work.
 */
export declare class ConcurrencyGuard {
    private readonly maxConcurrency;
    private readonly maxQueue;
    private active;
    private readonly queue;
    constructor(maxConcurrency: number, maxQueue?: number);
    /** Number of tasks currently executing (for tests/introspection). */
    get activeCount(): number;
    /** Number of tasks waiting for a slot. */
    get queuedCount(): number;
    private acquire;
    private release;
    /** Run `task` under the concurrency limit. Always releases the slot, even on failure. */
    run<T>(task: () => Promise<T>): Promise<T>;
}
