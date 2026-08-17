/**
 * Resolved configuration, from two layers:
 *
 * 1. Runtime config — `window.__TRACEDOWN_ENV__`, populated by `/config.js`
 *    (see `public/config.js`). The docker image regenerates that file from
 *    container environment variables at startup, so one built bundle can point
 *    at any endpoints without rebuilding.
 * 2. Build-time env — Vite's `import.meta.env` (`.env*` files / build args),
 *    inlined at build.
 *
 * Runtime wins over build-time; both fall back to same-origin defaults. This
 * module centralizes the small amount of normalization the raw strings need
 * (relative WS resolution, retry parsing) so the rest of the app reads typed
 * values, not raw config.
 */

interface RuntimeEnv {
  apiUrl?: string;
  wsUrl?: string;
  wsMaxRetries?: string | number;
}

declare global {
  interface Window {
    __TRACEDOWN_ENV__?: RuntimeEnv;
  }
}

const DEFAULT_WS_MAX_RETRIES = 5;

const runtime: RuntimeEnv = window.__TRACEDOWN_ENV__ ?? {};

/**
 * A relative WS path (e.g. `/ws`) is resolved against the current origin — the
 * `WebSocket` constructor needs an absolute URL, and same-origin deployments
 * don't know their host at build time. Absolute URLs pass through unchanged.
 */
function resolveWsUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('/')) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${raw}`;
  }
  return raw;
}

function parseRetries(raw: string | number | undefined, fallback: number): number {
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export const env = {
  apiUrl: runtime.apiUrl || import.meta.env.VITE_API_URL,
  wsUrl: resolveWsUrl(runtime.wsUrl || import.meta.env.VITE_WS_URL),
  wsMaxRetries: parseRetries(
    runtime.wsMaxRetries ?? import.meta.env.VITE_WS_MAX_RETRIES,
    DEFAULT_WS_MAX_RETRIES,
  ),
};
