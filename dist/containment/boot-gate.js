import { logger } from '../logger.js';
import { renderWithKroki } from '../render/kroki-client.js';
import { egressSelfCheck, tcpConnectProbe } from './egress-check.js';
import { canaryRender, CANARY_TOKEN } from './canary-render.js';
import { createCanarySink } from './canary-sink.js';
export async function runBootGate(deps) {
    const healthy = await deps.checkKrokiHealth().catch(() => false);
    if (!healthy) {
        logger.warn('boot.containment', { krokiHealth: 'fail', contained: false });
        return {
            contained: false,
            checks: {
                krokiHealth: 'fail',
                egressSelfCheck: 'fail',
                canaryRender: 'fail',
                krokiSafeMode: 'SECURE',
                publishedPorts: 'none',
            },
        };
    }
    const egress = await egressSelfCheck(deps.config, deps.egressProbe ?? tcpConnectProbe);
    const canary = await canaryRender(deps.canary);
    const contained = egress.pass && canary.pass;
    logger.info('boot.containment', {
        contained,
        krokiHealth: 'pass',
        egressSelfCheck: egress.pass ? 'pass' : 'fail',
        canaryRender: canary.pass ? 'pass' : 'fail',
        krokiSafeMode: 'SECURE',
    });
    return {
        contained,
        checks: {
            krokiHealth: 'pass',
            egressSelfCheck: egress.pass ? 'pass' : 'fail',
            canaryRender: canary.pass ? 'pass' : 'fail',
            krokiSafeMode: 'SECURE',
            publishedPorts: 'none',
        },
    };
}
/** Default Kroki healthcheck: GET `${baseUrl}/health`, expecting a 2xx. */
export function defaultKrokiHealth(config, fetchImpl = fetch) {
    return async () => {
        try {
            const res = await fetchImpl(`${config.krokiBaseUrl.replace(/\/+$/, '')}/health`, {
                method: 'GET',
            });
            return res.ok;
        }
        catch {
            return false;
        }
    };
}
/** Default `renderRaw`: render raw PlantUML via the internal Kroki, decoding the SVG output to text. */
export function defaultRenderRaw(config, fetchImpl = fetch) {
    return async (diagramType, source) => {
        try {
            const { bytes } = await renderWithKroki({
                baseUrl: config.krokiBaseUrl,
                diagramType,
                output: 'svg',
                source,
                timeoutMs: config.renderTimeoutMs,
                maxOutputBytes: config.maxOutputBytes,
            }, fetchImpl);
            return Buffer.from(bytes).toString('utf8');
        }
        catch {
            return null;
        }
    };
}
/**
 * Convenience used by the entrypoint: prove containment with the default, live dependencies. Spins
 * up an ephemeral in-process sink so the canary can assert a real zero-hit (not a vacuous token
 * check), then tears it down.
 */
export async function proveContainment(config, fetchImpl = fetch) {
    const sink = await createCanarySink(CANARY_TOKEN);
    try {
        return await runBootGate({
            config,
            checkKrokiHealth: defaultKrokiHealth(config, fetchImpl),
            canary: {
                renderRaw: defaultRenderRaw(config, fetchImpl),
                canaryUrl: sink.url,
                wasSinkHit: () => sink.wasHit(),
                sinkReachable: () => sink.routable,
            },
        });
    }
    finally {
        await sink.close();
    }
}
