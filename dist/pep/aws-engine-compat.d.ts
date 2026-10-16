/**
 * Engine compatibility shims for the AWS icon set (aws-icons `plan.md` D-11).
 *
 * The pinned Kroki engine (PlantUML compiled to a GraalVM native image) cannot **scale** an embedded
 * image: any `<img data:…{scale=…}>` with a scale other than 1 crashes with
 * `NoClassDefFoundError: java/awt/image/ComponentColorModel` and Kroki still answers HTTP 200 with a
 * stack-trace image. Upstream uses scale 0.5 in exactly two helpers — the group header icon
 * (`AWSCommon.puml`) and the experimental icon notes (`AWSExperimental.puml`).
 *
 * The resolver appends, right after inlining each of those files, a redefinition of the helper that
 * renders the same icon at scale 1. The vendored files stay byte-identical (RN-11); the overrides are
 * System content, so they obey the "safe source" rules and are re-scanned with the expanded source.
 * Remove a shim once a homologated engine renders scaled images.
 */
export declare const AWS_ENGINE_SHIMS: ReadonlyMap<string, string>;
/** Content to inline for `path`: the verified file, followed by its shim when one exists. */
export declare function withEngineShim(path: string, content: string): string;
