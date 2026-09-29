/** Result of a single containment gate. `pass: true` means the gate confirms containment. */
export interface CheckResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** Consolidated containment report, surfaced by the `containment_status` tool (`plan.md` §4.3). */
export interface ContainmentReport {
  readonly contained: boolean;
  readonly checks: {
    readonly krokiHealth: 'pass' | 'fail';
    readonly egressSelfCheck: 'pass' | 'fail';
    readonly canaryRender: 'pass' | 'fail';
    readonly krokiSafeMode: 'SECURE';
    readonly publishedPorts: 'none';
  };
}
