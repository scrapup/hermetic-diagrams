/**
 * Version binding (TF-79-01, RN-06). The MCP image is tagged with the package version, so a version
 * never runs on top of what another version prepared. The version is read only from the shipped
 * `package.json` — never from git or the environment.
 */
export declare const PACKAGE_NAME = "@scrapup/hermetic-diagrams";
/** Extract and validate the `version` field of a `package.json` document. */
export declare function parseVersion(packageJson: string): string;
/** Read the version of the package installed at `packageRoot`. */
export declare function readPackageVersion(packageRoot: string): string;
/** Local tag of the MCP gateway image for `version`. */
export declare function imageRef(version: string): string;
/** The exact one-time preparation command for `version`. */
export declare function upCommand(version: string): string;
