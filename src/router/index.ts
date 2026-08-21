import { createRouter, createWebHistory, type Router, type RouteRecordRaw } from 'vue-router';
import { getStoredToken } from '@/utils/tokenStorage';
import { useWorkspaceStore } from '@/store/core/workspace';
import { useNavigationStore } from '@/store/ui/navigation';
import { initSession, isSessionRestored, markSessionRestored } from '@/composables/useSessionInit';

declare module 'vue-router' {
  interface RouteMeta {
    /** Routes reachable without a session. */
    public?: boolean;
    /** i18n key appended to the document title. */
    title?: string;
    /** Key of the nav ribbon item this page belongs to (highlights it). */
    navItem?: string;
  }
}

let router: Router | null = null;

/**
 * Creates the app router from a route table (the built-in `appRoutes`, or a superset).
 * The instance is kept module-level so non-component code (e.g. the requests
 * host) can reach it via {@link getRouter}.
 */
export function createAppRouter(routes: RouteRecordRaw[]): Router {
  router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
  });
  installGuards(router);
  return router;
}

/** The active router instance, or null before `createAppRouter` ran. */
export function getRouter(): Router | null {
  return router;
}

function installGuards(r: Router) {
  r.beforeEach(async (to) => {
    // One-time session restore on hard load: hydrates user, orgs and
    // workspaces before the first authorized route resolves. An invalid token
    // is cleared inside, so the auth check below reroutes to login.
    // Public routes are skipped, and leave the flag unset so the first
    // authorized route still restores. A stale token in storage must otherwise
    // turn a password-reset or invite link into a bounce to /login: the restore
    // 401s, and the global unauthorized handler navigates away before the
    // public page can render.
    if (!isSessionRestored() && !to.meta.public) {
      if (getStoredToken()) {
        await initSession();
      } else {
        markSessionRestored();
      }
    }

    const authenticated = getStoredToken() != null;

    if (!to.meta.public && !authenticated) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }

    if (to.name === 'login' && authenticated) {
      return { name: 'home' };
    }

    // Root resolves to the selected (or first) workspace when one exists;
    // otherwise HomeView renders the no-workspace state.
    if (to.name === 'home' && authenticated) {
      const workspaceStore = useWorkspaceStore();
      if (workspaceStore.hasWorkspaces) {
        const valid = workspaceStore.workspaces.some(w => w.id === workspaceStore.selectedWorkspaceId);
        const id = valid && workspaceStore.selectedWorkspaceId
          ? workspaceStore.selectedWorkspaceId
          : workspaceStore.workspaces[0].id;
        workspaceStore.setSelectedWorkspace(id);
        return { name: 'workspace', params: { workspaceId: id } };
      }
    }
  });

  // The resolved route declares which ribbon item it belongs to.
  r.afterEach((to) => {
    useNavigationStore().setActiveItem(to.meta.navItem ?? null);
  });
}
