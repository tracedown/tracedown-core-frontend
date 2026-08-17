// Runtime configuration for the Tracedown dashboard.
//
// This file ships as a no-op: the app falls back to its build-time defaults
// (same-origin /api/v1 and /ws). To repoint a deployed bundle WITHOUT
// rebuilding, replace this file — the docker image does so automatically at
// container start from the API_URL / WS_URL / WS_MAX_RETRIES environment
// variables.
//
// window.__TRACEDOWN_ENV__ = {
//   apiUrl: "https://api.example.com/api/v1",
//   wsUrl: "wss://api.example.com/ws",
//   wsMaxRetries: 5,
// };
window.__TRACEDOWN_ENV__ = {};
