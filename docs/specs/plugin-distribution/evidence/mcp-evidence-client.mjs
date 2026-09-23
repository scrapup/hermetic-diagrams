// Speaks the MCP stdio protocol directly to a locally-installed hermetic-diagrams plugin build,
// bypassing the Claude Code harness, so the raw tool results (including the base64 image data
// the harness itself doesn't surface) can be captured as evidence.
//
// Usage: HERMETIC_DIAGRAMS_BIN=/path/to/dist/cli/bin.js node mcp-evidence-client.mjs
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';

const BIN =
  process.env.HERMETIC_DIAGRAMS_BIN ??
  `${homedir()}/.claude/plugins/cache/hermetic-diagrams/hermetic-diagrams/0.3.1/dist/cli/bin.js`;
const child = spawn('node', [BIN, 'serve'], { stdio: ['pipe', 'pipe', 'pipe'] });

child.stderr.on('data', (d) => process.stderr.write(`[stderr] ${d}`));

const rl = createInterface({ input: child.stdout });
let resolveMap = new Map();
let nextId = 1;

function send(method, params) {
  return new Promise((resolve) => {
    const id = nextId++;
    resolveMap.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

rl.on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id && resolveMap.has(msg.id)) {
    resolveMap.get(msg.id)(msg);
    resolveMap.delete(msg.id);
  }
});

(async () => {
  await send('initialize', {
    protocolVersion: '2026-06-18',
    capabilities: {},
    clientInfo: { name: 'evidence-script', version: '1.0.0' },
  });
  notify('notifications/initialized', {});

  const source = `@startuml
title US-78 smoke-test evidence -- hermetic-diagrams v0.3.1
actor User
participant "Claude Code" as CC
participant "hermetic-diagrams MCP" as MCP
User -> CC: /plugin install hermetic-diagrams
CC -> MCP: containment_status
MCP --> CC: contained=true, all checks pass
CC -> MCP: render_diagram(plantuml, png)
MCP --> CC: sanitized PNG (this file)
@enduml`;

  const statusResp = await send('tools/call', { name: 'containment_status', arguments: {} });
  const renderResp = await send('tools/call', { name: 'render_diagram', arguments: { format: 'plantuml', source, output: 'png' } });

  process.stdout.write('===STATUS===\n' + JSON.stringify(statusResp, null, 2) + '\n');
  process.stdout.write('===RENDER===\n' + JSON.stringify(renderResp, null, 2) + '\n');

  child.stdin.end();
  child.kill();
  process.exit(0);
})();
