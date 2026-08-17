# tracedown-core-frontend

The Tracedown dashboard — a Vue 3 single-page app for creating monitored
services, writing [Lace](https://lacelang.dev) probe scripts, reading results,
and managing users and alerting.

Tracedown is a self-hosted API monitoring platform. This repository is only the
web UI; it talks to [tracedown-core-backend](https://github.com/tracedown/tracedown-core-backend)
over its REST API and a WebSocket.

📖 **Documentation: [tracedown.dev](https://tracedown.dev)**

Stack: Vue 3, TypeScript (strict), Vite, Pinia, Vue Router, vue-i18n,
Tailwind CSS, Chart.js, and CodeMirror 6 for the Lace editor with live
validation.

## Running

The backend stack must be up first — see
[tracedown-core-backend](https://github.com/tracedown/tracedown-core-backend).

```bash
npm install
npm run dev      # Vite dev server on :5173
npm run build    # lint + type-check + production build
npm run lint
```

The dev server proxies `/api` and `/ws` to the backend at `localhost:20714` /
`localhost:20870` (see `vite.config.ts`), so the app always talks same-origin —
in dev and production alike. Production bundles are published as release
tarballs and served by a host web server; the deploy setup in
[tracedown-core-backend](https://github.com/tracedown/tracedown-core-backend)'s
`docker/deploy/` pulls and serves them.

An optional container build lives in `docker/` for anyone who prefers to build
and serve the SPA as its own image (it joins the backend stack's network and
proxies `/api` and `/ws` internally):

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Conventions

- All user-visible strings go through i18n (`t()`), none hardcoded.
- No `<style>` blocks — styling is Tailwind utility classes only.
- TypeScript strict. No `any`, no `enum` (use type unions).
- API calls live in Pinia store actions, never in components.
- Types shared by more than one file live in `src/types/`.

## License

Open source under the Apache License 2.0. See `LICENSE`.
