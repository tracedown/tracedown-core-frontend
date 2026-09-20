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

Endpoints are configurable at **runtime** via container env — `API_URL`,
`WS_URL`, `WS_MAX_RETRIES` are written into `/config.js` at container start,
so the same image can point at any backend without rebuilding. Unset means the
bundle's same-origin defaults. (Any deployment can use the same mechanism:
edit `config.js` next to `index.html`.)

## Extending it

This package is also consumed as a library: a host application ships its own entrypoint calling
`bootstrapApp(options)` and registers into the extension registries **before mount**. Everything
public is re-exported from `src/index.ts`. Nothing here is registered by default — the
un-extended app *is* the behaviour you get.

**Component slots** — `registerSlot(name, component)` fills a named `<SlotOutlet>`; several
components may share a name and all render, in registration order. Two collection-wide outlets:

| Outlet | Rendered in | Props |
|--------|-------------|-------|
| `resource-meta` | Beside a collection heading: `WorkspaceSelect`, `HomeView`, `WorkspaceOverview`, `ServiceList`, `OrgUsersTab`, `GroupsTab` | `{ resource }` — `workspaces`, `projects`, `services`, `users`, `groups` |
| `status-decoration` | Beside a status indicator: `ServiceListItem`, `ServiceDetailHeader`, `ProjectCard` | `StatusDecorationProps` — `{ resource: 'service', service }` or `{ resource: 'project', project }` |

`status-decoration` is for a host that knows the status shown is no longer being kept up to
date; the indicator itself stays what Tracedown measured.

**Feature gates** — `registerFeatureGate(feature, predicate)` lets a host veto a named feature
per subject. A feature is available unless a predicate vetoes it, and the predicate is
re-evaluated on every check, so it may read reactive state:

```ts
registerFeatureGate('service.run', ({ orgId }) =>
  isFrozen(orgId) ? { enabled: false, reason: 'Runs are paused for this organization.' } : true);
```

Returning `false` closes the control with the app's generic wording; returning
`{ enabled: false, reason }` closes it with the host's own (already-localized) text, shown where
the control is. `checkFeature(feature, { orgId })` returns `{ enabled, reason }`;
`isFeatureEnabled` is the boolean shorthand; in a component, `useFeatureGate(feature)` returns
`{ enabled, hint }` ready to bind.

A *create* or *run* gate closes only that one control — editing and deleting existing items are
never affected:

`workspace.create` · `project.create` · `service.create` · `service.run` · `group.create` ·
`invite.create` · `organization.variable.create` · `workspace.variable.create` ·
`project.variable.create` · `service.variable.create` · `webhook.create` ·
`webhook.variable.create` · `domain.create` · `notificationTemplate.create` ·
`rulePreset.create` · `silence.create` (placing one, never lifting one) ·
`grafanaIntegration.create` · `apiKey.create` · `agent.create` · `bodyStore.create`

A *visibility* gate hides a whole surface instead: `agents`, `agents.fleet`, `bodyStores`,
`invite.accept`, and any nav item's `feature`.

## Conventions

- All user-visible strings go through i18n (`t()`), none hardcoded.
- No `<style>` blocks — styling is Tailwind utility classes only.
- TypeScript strict. No `any`, no `enum` (use type unions).
- API calls live in Pinia store actions, never in components.
- Types shared by more than one file live in `src/types/`.

## License

Open source under the Apache License 2.0. See `LICENSE`.

The Tracedown **name and logo** (`public/logo.svg` and the derived icons) are
trademarks of the Tracedown project and are **not** covered by the Apache
license: unmodified use to refer to Tracedown is welcome; modification, or use
as another product's mark, is not. Policy:
[tracedown.dev/project/brand](https://tracedown.dev/project/brand/).
