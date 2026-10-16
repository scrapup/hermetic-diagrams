import net from 'node:net';
/** Default probe: opens a socket, resolves on the first of connect/error/timeout, sends nothing. */
export const tcpConnectProbe = (host, port, timeoutMs) => new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (connected) => {
        if (settled)
            return;
        settled = true;
        socket.destroy();
        resolve(connected);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
});
export async function egressSelfCheck(config, probe = tcpConnectProbe) {
    const connected = await probe(config.egressCheckHost, config.egressCheckPort, config.egressCheckTimeoutMs);
    return {
        name: 'egressSelfCheck',
        pass: !connected,
        detail: connected
            ? `Reached ${config.egressCheckHost}:${config.egressCheckPort} — an external route exists.`
            : 'No external route: the outbound connect did not succeed.',
    };
}
