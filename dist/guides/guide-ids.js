import { INPUT_FORMATS } from '../domain.js';
/**
 * The closed set of authoring guides (aws-icons `plan.md` §3.3, RN-13): one per supported notation
 * plus one per AWS diagram kind. A notation added to `INPUT_FORMATS` without a guide fails CI.
 */
export const AWS_GUIDE_IDS = ['aws-architecture', 'aws-sequence', 'aws-c4', 'aws-simplified', 'aws-dark'];
export const GUIDE_IDS = [...INPUT_FORMATS, ...AWS_GUIDE_IDS];
/** The notation each guide teaches (used by `list_authoring_guides` and the example harness). */
export function guideNotation(id) {
    if (id === 'aws-c4')
        return 'c4';
    if (AWS_GUIDE_IDS.includes(id))
        return 'plantuml';
    return id;
}
export function isGuideId(value) {
    return GUIDE_IDS.includes(value);
}
