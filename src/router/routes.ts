import type { RouteRecordRaw } from 'vue-router';
import AuthorizedView from '@/components/layout/AuthorizedView.vue';

/**
 * The built-in application route table, passed to `createAppRouter`;
 * a different entrypoint can build its own array (spreading this one) and
 * create the router from that instead.
 */
export const appRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: 'nav.login' },
  },
  {
    path: '/invite/:token',
    name: 'invite-accept',
    component: () => import('@/views/InviteAcceptView.vue'),
    meta: { public: true, title: 'invite.title' },
  },
  {
    path: '/reset-password/:token?',
    name: 'password-reset',
    component: () => import('@/views/PasswordResetView.vue'),
    meta: { public: true, title: 'auth.reset.title' },
  },
  {
    path: '/confirm-email/:token',
    name: 'confirm-email',
    component: () => import('@/views/ConfirmEmailView.vue'),
    meta: { public: true, title: 'auth.confirmEmail.title' },
  },
  {
    path: '/',
    name: 'authorized',
    component: AuthorizedView,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: 'workspace.noWorkspaces', navItem: 'home' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: 'common.labels.settings', navItem: 'settings' },
      },

      {
        path: 'users',
        name: 'org-users',
        component: () => import('@/views/UsersView.vue'),
        meta: { title: 'nav.users', navItem: 'users' },
      },

      // ── Infrastructure, audit, account, and workspace/project detail views ──
      {
        path: 'infrastructure',
        name: 'infrastructure',
        component: () => import('@/views/InfrastructureView.vue'),
        meta: { title: 'nav.infrastructure', navItem: 'infrastructure' },
      },
      {
        path: 'audit',
        name: 'audit',
        component: () => import('@/views/AuditView.vue'),
        meta: { title: 'nav.audit', navItem: 'audit' },
      },
      {
        path: 'account',
        name: 'account',
        component: () => import('@/views/AccountView.vue'),
        meta: { title: 'nav.account' },
      },
      {
        path: 'workspace/:workspaceId',
        name: 'workspace',
        component: () => import('@/views/WorkspaceView.vue'),
        meta: { title: 'workspace.title', navItem: 'home' },
      },
      {
        path: 'project/:projectId',
        name: 'project',
        component: () => import('@/views/ProjectView.vue'),
        meta: { title: 'common.entities.projects', navItem: 'home' },
      },
      {
        path: 'resource-not-found',
        name: 'resource-not-found',
        component: () => import('@/views/NotFound/ResourceNotFoundView.vue'),
        meta: { title: 'resource.notFound' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound/NotFoundView.vue'),
    meta: { public: true, title: 'resource.pageNotFound' },
  },
];
