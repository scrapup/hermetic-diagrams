import { logger } from '../logger.js';
/**
 * Icon Set Store (`plan.md` §3.2, §4.7, D-06). At boot it reads `aws-icons.lock.json`, validates it
 * with the shared contract guard (`parseLock`, no new dependency, D-10), reads every listed file and compares its
 * sha256. The result is an **in-memory allowlist**: the resolver only ever does an exact `Map.get`
 * on it — Requester input never reaches the filesystem.
 *
 * A bad set never stops the gateway: it is reported `UNVERIFIED` (AWS includes are then refused with
 * `ICONS_UNAVAILABLE`) while every other notation keeps working.
 */
export type IconSetState = 'VERIFIED' | 'UNVERIFIED';
export type IconSetFailure = 'lock_invalid' | 'file_missing' | 'hash_mismatch';
export interface IconSet {
    readonly state: IconSetState;
    readonly reason?: IconSetFailure;
    /** Upstream tag in force; `null` when the lock itself could not be read. */
    readonly version: string | null;
    /** `AWSPuml/`-relative path → verified UTF-8 content. Empty unless `VERIFIED`. */
    readonly files: ReadonlyMap<string, string>;
    /** Category → icon paths in manifest order (drives the synthetic `<Category>/all.puml`). */
    readonly categories: ReadonlyMap<string, readonly string[]>;
    /** Files whose verification failed (count only — never names, RN-12). */
    readonly failedFiles: number;
}
/**
 * @param iconsRoot directory holding `<tag>/` (in the image: `/app/assets/aws-icons`)
 * @param lockPath  path of `aws-icons.lock.json`
 */
export declare function loadIconSet(iconsRoot: string, lockPath: string): Promise<IconSet>;
/** `containment_status.awsIcons` (`plan.md` §4.7). */
export interface AwsIconsStatus {
    readonly state: 'verified' | 'unverified';
    readonly version: string | null;
    readonly reason?: IconSetFailure;
}
export declare function awsIconsStatus(iconSet: IconSet): AwsIconsStatus;
type BootLogger = Pick<typeof logger, 'info' | 'warn'>;
/** Boot-time load with the `boot.aws_icons` event (`plan.md` §5.3): counts only, never names. */
export declare function bootIconSet(iconsRoot: string, lockPath: string, log?: BootLogger): Promise<IconSet>;
export {};
