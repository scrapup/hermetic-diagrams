import { type DiagramFormat } from '../domain.js';
/**
 * The closed set of authoring guides (aws-icons `plan.md` §3.3, RN-13): one per supported notation
 * plus one per AWS diagram kind. A notation added to `INPUT_FORMATS` without a guide fails CI.
 */
export declare const AWS_GUIDE_IDS: readonly ["aws-architecture", "aws-sequence", "aws-c4", "aws-simplified", "aws-dark"];
export type AwsGuideId = (typeof AWS_GUIDE_IDS)[number];
export type GuideId = DiagramFormat | AwsGuideId;
export declare const GUIDE_IDS: readonly GuideId[];
/** The notation each guide teaches (used by `list_authoring_guides` and the example harness). */
export declare function guideNotation(id: GuideId): DiagramFormat;
export declare function isGuideId(value: string): value is GuideId;
