import { type GuideId } from './guide-ids.js';
import type { DiagramFormat } from '../domain.js';
/**
 * Guide Catalog (aws-icons `plan.md` §3.2–3.3): loads the shipped Markdown guides once at boot from
 * a **closed** id set (no directory listing, no Requester-controlled path), resolves the single
 * `{{AWS_ICONS_VERSION}}` placeholder and serves them from memory. A missing file only omits that
 * guide (CI makes it impossible in a release).
 */
export declare const AWS_ICONS_VERSION_PLACEHOLDER = "{{AWS_ICONS_VERSION}}";
export interface Guide {
    readonly id: GuideId;
    readonly title: string;
    readonly summary: string;
    readonly notation: DiagramFormat;
    readonly markdown: string;
}
export interface GuideCatalog {
    readonly awsIconsVersion: string | null;
    readonly guides: ReadonlyMap<GuideId, Guide>;
}
/** Title = first `# ` line; summary = the first paragraph after it. */
export declare function parseGuide(id: GuideId, markdown: string): Guide;
export declare function loadGuideCatalog(guidesRoot: string, awsIconsVersion: string | null): Promise<GuideCatalog>;
