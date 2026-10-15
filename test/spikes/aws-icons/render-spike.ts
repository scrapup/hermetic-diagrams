/**
 * TF-105-01 spike (throwaway, not part of any vitest project): proves that a self-contained source
 * built from the upstream v23.1 files renders in the pinned Kroki under `KROKI_SAFE_MODE=SECURE`.
 *
 * Runs **inside** the `internal: true` network (one-off container), with `KROKI_BASE_URL` pointing at
 * the internal Kroki service (`kroki:8000` on that network), e.g.:
 *   docker run --rm --network hermetic-diagrams_hermetic -e KROKI_BASE_URL=... \
 *     -v "$PWD/test/spikes/aws-icons:/spike:ro" -v "<extracted>/dist:/aws:ro" -v "<out>:/out" \
 *     node:24 node /spike/render-spike.ts /aws /out
 *
 * The upstream files are untrusted data: they are only read and concatenated, never executed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface SpikeCase {
  readonly id: string;
  readonly diagramType: 'plantuml' | 'c4plantuml';
  readonly build: (read: (p: string) => string) => string;
}

const KROKI = process.env['KROKI_BASE_URL'];

const CASES: readonly SpikeCase[] = [
  {
    id: 'a-entity-macros',
    diagramType: 'plantuml',
    build: (read) =>
      [
        '@startuml',
        read('AWSCommon.puml'),
        read('Compute/Lambda.puml'),
        read('Storage/SimpleStorageService.puml'),
        'Lambda(fn, "Handler", "Node.js 24")',
        'SimpleStorageService(bucket, "Assets", "S3")',
        'fn --> bucket',
        '@enduml',
      ].join('\n'),
  },
  {
    id: 'b-img-data-uri',
    diagramType: 'plantuml',
    build: (read) =>
      [
        '@startuml',
        read('AWSCommon.puml'),
        read('Compute/Lambda.puml'),
        read('Storage/SimpleStorageService.puml'),
        'rectangle "$LambdaIMG()\\nHandler" as fn',
        'rectangle "$SimpleStorageServiceIMG()\\nAssets" as bucket',
        'fn --> bucket',
        '@enduml',
      ].join('\n'),
  },
  {
    id: 'c-c4-integration',
    diagramType: 'c4plantuml',
    build: (read) =>
      [
        '@startuml',
        '!include <C4/C4_Container>',
        read('AWSC4Integration.puml'),
        read('AWSCommon.puml'),
        read('Compute/Lambda.puml'),
        read('Database/DynamoDB.puml'),
        'Person(user, "User")',
        'Container(fn, "Handler", "Lambda", "Serves requests", $sprite="Lambda")',
        'ContainerDb(table, "Orders", "DynamoDB", "Stores orders", $sprite="DynamoDB")',
        'Rel(user, fn, "Calls")',
        'Rel(fn, table, "Reads/writes")',
        '@enduml',
      ].join('\n'),
  },
  {
    id: 'd-dark-mode',
    diagramType: 'plantuml',
    build: (read) =>
      [
        '@startuml',
        '!$AWS_DARK = true',
        read('AWSCommon.puml'),
        read('Compute/Lambda.puml'),
        'Lambda(fn, "Handler", "Node.js 24")',
        '@enduml',
      ].join('\n'),
  },
  {
    id: 'e-storage-all',
    diagramType: 'plantuml',
    build: (read) =>
      [
        '@startuml',
        read('AWSCommon.puml'),
        read('Storage/all.puml'),
        'SimpleStorageService(bucket, "Assets", "S3")',
        'Backup(bk, "Backups", "AWS Backup")',
        'bucket --> bk',
        '@enduml',
      ].join('\n'),
  },
];

async function main(): Promise<void> {
  const [awsRoot, outDir] = process.argv.slice(2);
  if (awsRoot === undefined || outDir === undefined || KROKI === undefined) {
    throw new Error('usage: KROKI_BASE_URL=<internal kroki> render-spike.ts <aws-dist-dir> <out-dir>');
  }
  mkdirSync(outDir, { recursive: true });
  const read = (p: string): string => readFileSync(join(awsRoot, p), 'utf8');
  const results: unknown[] = [];

  for (const c of CASES) {
    const source = c.build(read);
    writeFileSync(join(outDir, `${c.id}.puml`), source);
    for (const output of ['svg', 'png'] as const) {
      const started = performance.now();
      const res = await fetch(`${KROKI}/${c.diagramType}/${output}`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: source,
      });
      const body = new Uint8Array(await res.arrayBuffer());
      const durationMs = Math.round(performance.now() - started);
      writeFileSync(join(outDir, `${c.id}.${output}`), body);
      results.push({
        id: c.id,
        output,
        status: res.status,
        sourceBytes: Buffer.byteLength(source),
        outputBytes: body.byteLength,
        durationMs,
      });
    }
  }
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

await main();
