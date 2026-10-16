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

const NOTE = "' hermetic-diagrams engine compatibility: the pinned engine cannot scale embedded images.";

export const AWS_ENGINE_SHIMS: ReadonlyMap<string, string> = new Map([
  [
    'AWSCommon.puml',
    [
      NOTE,
      '!function $AWSGroupImg($service)',
      '!return %call_user_func("$" + $service + "IMG")',
      '!endfunction',
    ].join('\n'),
  ],
  [
    'AWSExperimental.puml',
    [
      NOTE,
      '!procedure $AWSIconNote($service, $label="", $side="left")',
      'note<<AWSIcon>> $side',
      '   %call_user_func("$" + $service + "IMG")',
      '!if %not($label == "")',
      '   $label',
      '!endif',
      'end note',
      '!endprocedure',
    ].join('\n'),
  ],
]);

/** Content to inline for `path`: the verified file, followed by its shim when one exists. */
export function withEngineShim(path: string, content: string): string {
  const shim = AWS_ENGINE_SHIMS.get(path);
  if (shim === undefined) return content;
  return `${content}${content.endsWith('\n') ? '' : '\n'}${shim}`;
}
