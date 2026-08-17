import { createApp, type App } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import AppRoot from '@/App.vue';
import { createAppRouter } from '@/router';
import { appRoutes } from '@/router/routes';
import { prefetchRouteComponents } from '@/router/prefetch';
import i18n from '@/plugins/i18n';
import { DEFAULT_NAV_ITEMS } from '@/config/navigation';
import { env } from '@/config/env';
import { registerFeatureGate } from '@/config/extensions';
import { useNavigationStore } from '@/store/ui/navigation';
import { startTicks } from '@/lib/timeTick';
import type { BootstrapOptions } from '@/types/bootstrap';

// Side-effect import: configures the requests library and installs the live
// runtime singleton. Loading-store lookups inside are lazy, so order vs. Pinia
// install does not matter.
import '@/config/requests';

import '@fontsource-variable/red-hat-display';
import '@/styles/style.css';
import '@/styles/graphs.css';

/**
 * Builds the application: creates the Vue app, router, Pinia and i18n, wires
 * plugins, registers the default nav items, then (by default) mounts and warms
 * the lazy route chunks. A host entrypoint reuses this to extend the app with
 * additional routes, locale messages and startup hooks.
 */
export function bootstrapApp(options: BootstrapOptions = {}): App {
  const { extraRoutes, extraChildRoutes, extraMessages, onSetup, mount = true } = options;

  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);

  const app = createApp(AppRoot);
  const router = createAppRouter([...appRoutes, ...(extraRoutes ?? [])]);

  // Before `app.use(router)`, which resolves the initial URL: a child route
  // added after that point does not exist for a direct load of its path, and
  // the visitor lands on the not-found page until they navigate client-side.
  for (const [parent, routes] of Object.entries(extraChildRoutes ?? {})) {
    for (const route of routes) router.addRoute(parent, route);
  }

  app.config.errorHandler = (err) => {
    console.error('Unhandled error:', err);
  };

  if (extraMessages) {
    for (const [locale, messages] of Object.entries(extraMessages)) {
      i18n.global.mergeLocaleMessage(locale, messages);
    }
  }

  app.use(pinia);
  app.use(router);
  app.use(i18n);

  // Features the deployment's runtime config declares unavailable are vetoed
  // for every context — the deployment knows capabilities the bundle cannot
  // (a backend executing probes in-process has no agents to manage).
  for (const [feature, enabled] of Object.entries(env.features)) {
    if (!enabled) registerFeatureGate(feature, () => false);
  }

  useNavigationStore(pinia).registerNavItems(DEFAULT_NAV_ITEMS);

  onSetup?.(app);

  startTicks();

  if (mount) {
    app.mount('#app');
    // Warm the lazy route chunks once idle — first navigation shouldn't stall
    // on a JS download before its data requests can even start.
    prefetchRouteComponents(router);
  }

  return app;
}
