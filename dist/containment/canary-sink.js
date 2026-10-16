import http from 'node:http';
import os from 'node:os';
/** First non-internal IPv4 of this host/container, or null when only loopback exists. */
function primaryIPv4() {
    for (const list of Object.values(os.networkInterfaces())) {
        for (const ni of list ?? []) {
            if (ni.family === 'IPv4' && !ni.internal)
                return ni.address;
        }
    }
    return null;
}
export async function createCanarySink(token) {
    let hit = false;
    const server = http.createServer((req, res) => {
        // Only the canary include path counts as a leak; the self-probe uses a different path.
        if ((req.url ?? '').includes('canary'))
            hit = true;
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(token);
    });
    await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
    const { port } = server.address();
    const ip = primaryIPv4();
    const base = ip !== null ? `http://${ip}:${port}` : `http://127.0.0.1:${port}`;
    // Positive reachability proof: confirm the bound address answers a probe (not on the canary path).
    let routable = ip !== null;
    if (routable) {
        try {
            const res = await fetch(`${base}/probe`);
            routable = res.ok;
        }
        catch {
            routable = false;
        }
    }
    return {
        url: `${base}/canary`,
        routable,
        wasHit: () => hit,
        close: () => new Promise((resolve) => server.close(() => resolve())),
    };
}
