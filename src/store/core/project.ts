import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { aggregateMetrics } from '@/lib/metrics-utils';
import { defaultPfsParams, DEFAULT_PAGE_SIZE, pfsToQueryString } from '@/utils/pfs';
import type { Page, PfsFilter } from '@/types/pfs';
import type { CreateProjectRequest, ProjectSummary, UpdateProjectRequest } from '@/data/projects/ProjectDto';
import type { MetricsDelta } from '@/data/metrics/MetricsDto';
import type { ActionDataResult, ActionResult, FetchOptions } from '@/types/actions';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<ProjectSummary[]>([]);
  const totalResults = ref<number>(0);
  const loading = ref<boolean>(false);
  const page = ref<number>(1);
  /** `workspaceId|search|page` of the currently loaded page — repeat fetches are skipped. */
  const fetchedKey = ref<string | null>(null);

  /** Monotonic fetch generation — a superseded response is discarded on arrival. */
  let generation = 0;

  /** True when all results fit on the current page — local aggregation is accurate. */
  const isFullPage = computed(() => totalResults.value <= DEFAULT_PAGE_SIZE);

  /** Aggregates metrics from all projects on the current page. */
  const aggregatedMetrics = computed(() => aggregateMetrics(projects.value));

  /**
   * Synchronously drops all data when it belongs to a different workspace.
   * Views call this first on navigation so no stale frame ever renders.
   */
  function ensureContext(workspaceId: string) {
    if (fetchedKey.value !== null && !fetchedKey.value.startsWith(`${workspaceId}|`)) {
      clear();
    }
  }

  async function fetchProjects(
    workspaceId: string,
    search?: string,
    opts: FetchOptions & { page?: number } = {},
  ): Promise<ActionResult> {
    const prefix = `${workspaceId}|${search?.trim() ?? ''}`;
    if (opts.page !== undefined) {
      page.value = opts.page;
    } else if (fetchedKey.value !== null && !fetchedKey.value.startsWith(`${prefix}|`)) {
      // Workspace or search changed — restart from the first page.
      page.value = 1;
    }
    const key = `${prefix}|${page.value}`;
    if (!opts.force && fetchedKey.value === key) {
      // Stale-while-revalidate: the cached list renders instantly, a silent
      // background refetch trues it up (e.g. service counts changed while
      // this view wasn't mounted).
      if (!opts.silent) {
        void fetchProjects(workspaceId, search, { force: true, silent: true });
      }
      return { ok: true };
    }
    // Safety net — views normally reset via ensureContext() at navigation
    // time; a mere search change keeps the current list visible.
    ensureContext(workspaceId);
    const gen = ++generation;
    if (!opts.silent) loading.value = true;
    try {
      const filters: PfsFilter[] = search?.trim()
        ? [{ table: 'projects', column: 'name', operator: 'like', value: search.trim(), ignoreCase: true }]
        : [];
      const pfs = defaultPfsParams({
        page: page.value,
        filters,
        sorters: [{ table: 'projects', column: 'created_at', order: 'desc' }],
      });
      const res = await http.get<Page<ProjectSummary>>(
        `/projects?workspaceId=${workspaceId}${pfsToQueryString(pfs, '&')}`,
        { disableLoading: opts.silent },
      );
      // A newer fetch superseded this one — a slow stale response must not
      // overwrite fresher data.
      if (gen !== generation) return { ok: true };
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      projects.value = res.data.items;
      totalResults.value = res.data.total;
      fetchedKey.value = key;
      return { ok: true };
    } finally {
      if (!opts.silent) loading.value = false;
    }
  }

  /** Fetches a single project (direct URL navigation). A 404 redirects to resource-not-found. */
  async function fetchProject(projectId: string): Promise<ProjectSummary | null> {
    const res = await http.get<ProjectSummary>(`/projects/${projectId}`, {
      redirectOnNotFound: true,
    });
    const project = res.data ?? null;
    // Append into the list unless it is a cached list of ANOTHER workspace —
    // that one must not grow a foreign card. With no list fetched yet (hard
    // refresh directly on /project/…), the project must still be stored, or
    // the view that awaits it spins on Loading forever.
    if (project
      && (fetchedKey.value == null || fetchedKey.value.startsWith(`${project.workspaceId}|`))
      && !projects.value.find(p => p.id === project.id)) {
      projects.value.push(project);
    }
    return project;
  }

  async function createProject(request: CreateProjectRequest): Promise<ActionDataResult<ProjectSummary>> {
    const res = await http.post<ProjectSummary, CreateProjectRequest>('/projects', request);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    projects.value.push(res.data);
    totalResults.value++;
    return { ok: true, data: res.data };
  }

  async function renameProject(id: string, name: string): Promise<ActionResult> {
    const res = await http.patch<ProjectSummary, UpdateProjectRequest>(`/projects/${id}`, { name });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    const project = projects.value.find(p => p.id === id);
    if (project) project.name = name;
    return { ok: true };
  }

  /**
   * Folds a server-aggregated probe delta into a project card's roll-up so
   * the workspace grid ticks live between list refetches.
   */
  function applyMetricsDelta(projectId: string, delta: MetricsDelta) {
    const project = projects.value.find(p => p.id === projectId);
    if (!project || delta.total === 0) return;
    const metrics = project.metrics ?? {
      counters: { probesTotal: 0, probesSuccess: 0, probesFailure: 0, probesTimeout: 0 },
      state: { lastStatus: null, lastConsecutive: 0, lastResponseMs: 0, lastRunAt: null },
      percentiles: null,
    };
    metrics.counters.probesTotal += delta.total;
    metrics.counters.probesSuccess += delta.success;
    metrics.counters.probesFailure += delta.failure;
    metrics.counters.probesTimeout += delta.timeout;
    metrics.state.lastStatus = delta.failure > 0 ? 'failure' : delta.timeout > 0 ? 'timeout' : 'success';
    metrics.state.lastResponseMs = Math.round(delta.sumMs / Math.max(delta.callCount, 1));
    metrics.state.lastRunAt = Math.floor(Date.now() / 1000);
    project.metrics = metrics;
  }

  async function deleteProject(id: string): Promise<ActionResult> {
    const res = await http.delete(`/projects/${id}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    projects.value = projects.value.filter(p => p.id !== id);
    totalResults.value--;
    return { ok: true };
  }

  function clear() {
    projects.value = [];
    totalResults.value = 0;
    page.value = 1;
    fetchedKey.value = null;
  }

  return {
    projects, totalResults, loading, page, pageSize: DEFAULT_PAGE_SIZE, isFullPage, aggregatedMetrics,
    ensureContext, fetchProjects, fetchProject, createProject, renameProject, applyMetricsDelta, deleteProject, clear,
  };
});
