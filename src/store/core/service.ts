import { reactive, ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { aggregateMetrics } from '@/lib/metrics-utils';
import {
  applyProbeResult as applyProbeToBuckets,
  findService,
  updateServiceInPlace,
} from '@/lib/serviceBuckets';
import { defaultPfsParams, DEFAULT_PAGE_SIZE, pfsToQueryString } from '@/utils/pfs';
import { CATEGORY_STATUS_FILTERS, SERVICE_CATEGORIES } from '@/utils/serviceCategories';
import type { Page, PfsFilter } from '@/types/pfs';
import type { ServiceCategory, ServiceCategoryState } from '@/types/services';
import type { FailedAssertion,
  CreateServiceRequest,
  ScopedToggleResult,
  ServiceSummary,
  ToggleServiceRequest,
  UpdateServiceConfigRequest,
  UpdateServiceScriptRequest,
} from '@/data/services/ServiceDto';
import type { ActionDataResult, ActionResult, FetchOptions } from '@/types/actions';

export const useServiceStore = defineStore('service', () => {
  const categories = reactive<Record<ServiceCategory, ServiceCategoryState>>({
    failed: { items: [], total: 0 },
    new: { items: [], total: 0 },
    healthy: { items: [], total: 0 },
  });
  const loading = ref<boolean>(false);
  /** `projectId|search` of the currently loaded list — repeat fetches are skipped. */
  const fetchedKey = ref<string | null>(null);

  /** Monotonic fetch generation — a superseded response is discarded on arrival. */
  let generation = 0;

  /** All loaded services in display order: failed, new, healthy. */
  const services = computed(() => [
    ...categories.failed.items, ...categories.new.items, ...categories.healthy.items,
  ]);
  const totalResults = computed(() =>
    categories.failed.total + categories.new.total + categories.healthy.total);

  /** True when all results fit on one page — local aggregation is accurate. */
  const isFullPage = computed(() => totalResults.value <= DEFAULT_PAGE_SIZE);

  /** Aggregates metrics from all services on the current page. */
  const aggregatedMetrics = computed(() => aggregateMetrics(services.value));

  function buildPfs(search: string | undefined, category: ServiceCategory, page: number) {
    const filters: PfsFilter[] = [];
    if (search?.trim()) {
      filters.push({ table: 'services', column: 'name', operator: 'like', value: search.trim(), ignoreCase: true });
    }
    filters.push({ table: 'services', column: 'last_status', ...CATEGORY_STATUS_FILTERS[category] });
    return defaultPfsParams({
      page,
      filters,
      sorters: [{ table: 'probe_results', column: 'started_at', order: 'desc' }],
    });
  }

  /** Fetches one category page and replaces that category's state. */
  async function fetchCategoryPage(
    projectId: string,
    category: ServiceCategory,
    search: string | undefined,
    silent: boolean | undefined,
    gen: number,
  ): Promise<ActionResult> {
    const pfs = buildPfs(search, category, 1);
    const res = await http.get<Page<ServiceSummary>>(
      `/services?projectId=${projectId}${pfsToQueryString(pfs, '&')}`,
      { disableLoading: silent },
    );
    // A newer fetch superseded this one — a slow stale response must not
    // overwrite fresher data.
    if (gen !== generation) return { ok: true };
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    categories[category].items = res.data.items;
    categories[category].total = res.data.total;
    return { ok: true };
  }

  /**
   * Synchronously drops all data when it belongs to a different project.
   * Views call this first on navigation so no stale frame ever renders;
   * the zero state then fills once — straight to the actual data.
   */
  function ensureContext(projectId: string) {
    if (fetchedKey.value !== null && !fetchedKey.value.startsWith(`${projectId}|`)) {
      clear();
    }
  }

  /** Fetches all categories in parallel. Cached per project+search unless forced. */
  async function fetchServices(
    projectId: string,
    search?: string,
    opts: FetchOptions = {},
  ): Promise<ActionResult> {
    const key = `${projectId}|${search?.trim() ?? ''}`;
    if (!opts.force && fetchedKey.value === key) {
      // Stale-while-revalidate: the cached list renders instantly, a silent
      // background refetch trues it up.
      if (!opts.silent) {
        void fetchServices(projectId, search, { force: true, silent: true });
      }
      return { ok: true };
    }
    // Safety net — views normally reset via ensureContext() at navigation
    // time; a mere search change keeps the current list visible.
    ensureContext(projectId);
    const gen = ++generation;
    if (!opts.silent) loading.value = true;
    try {
      const results = await Promise.all(SERVICE_CATEGORIES.map(category =>
        fetchCategoryPage(projectId, category, search, opts.silent, gen)));
      const failed = results.find(r => !r.ok);
      if (!failed && gen === generation) fetchedKey.value = key;
      return failed ?? { ok: true };
    } finally {
      if (!opts.silent) loading.value = false;
    }
  }

  async function fetchService(serviceId: string): Promise<ServiceSummary | null> {
    const res = await http.get<ServiceSummary>(`/services/${serviceId}`, { disableLoading: true });
    return res.data ?? null;
  }

  /** Fetches a single service and updates it in place (used by live updates). */
  async function refreshService(serviceId: string) {
    const updated = await fetchService(serviceId);
    if (updated) updateInPlace(serviceId, updated);
  }

  async function createService(request: CreateServiceRequest): Promise<ActionDataResult<ServiceSummary>> {
    const res = await http.post<ServiceSummary, CreateServiceRequest>('/services', request);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    categories.new.items.unshift(res.data);
    categories.new.total++;
    return { ok: true, data: res.data };
  }

  async function deleteService(id: string): Promise<ActionResult> {
    const res = await http.delete(`/services/${id}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    const found = findService(categories, id);
    if (found) {
      categories[found.category].items.splice(found.index, 1);
      categories[found.category].total--;
    }
    return { ok: true };
  }

  async function updateServiceConfig(
    serviceId: string,
    config: UpdateServiceConfigRequest,
  ): Promise<ActionDataResult<ServiceSummary>> {
    const res = await http.patch<ServiceSummary, UpdateServiceConfigRequest>(`/services/${serviceId}`, config);
    return applyUpdateResponse(serviceId, res.success ? res.data : undefined, res.errorInfo?.message);
  }

  async function updateScript(
    serviceId: string,
    script: string,
    version: number,
  ): Promise<ActionDataResult<ServiceSummary>> {
    const res = await http.patch<ServiceSummary, UpdateServiceScriptRequest>(
      `/services/${serviceId}/script`,
      { script, version },
    );
    return applyUpdateResponse(serviceId, res.success ? res.data : undefined, res.errorInfo?.message);
  }

  async function toggleService(serviceId: string, isActive: boolean): Promise<ActionDataResult<ServiceSummary>> {
    const res = await http.patch<ServiceSummary, ToggleServiceRequest>(
      `/services/${serviceId}/toggle`,
      { isActive },
    );
    return applyUpdateResponse(serviceId, res.success ? res.data : undefined, res.errorInfo?.message);
  }

  /**
   * Enables or disables every service in a project or workspace, in one call.
   *
   * The whole scope moves or none of it does — the backend runs it as a single
   * transaction — so there is no partial state to reconcile here. The loaded
   * list is refetched rather than patched in place: the response reports counts,
   * not the rows, and a scope can touch services outside the current page.
   */
  async function toggleServicesInScope(
    scope: 'project' | 'workspace',
    scopeId: string,
    isActive: boolean,
  ): Promise<ActionDataResult<ScopedToggleResult>> {
    const collection = scope === 'project' ? 'projects' : 'workspaces';
    const res = await http.patch<ScopedToggleResult, ToggleServiceRequest>(
      `/${collection}/${scopeId}/services/toggle`,
      { isActive },
    );
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    if (res.data.changed > 0) await refreshLoadedList();
    return { ok: true, data: res.data };
  }

  /**
   * Refetches whatever service list is currently loaded, if any.
   *
   * A workspace-scoped change can reach the open project without naming it, so
   * the loaded key — not the scope — decides what to reload. Silent and forced:
   * the list is already on screen and its cache entry is now wrong.
   */
  async function refreshLoadedList(): Promise<void> {
    const key = fetchedKey.value;
    if (!key) return;
    const separator = key.indexOf('|');
    const projectId = key.slice(0, separator);
    const search = key.slice(separator + 1);
    await fetchServices(projectId, search || undefined, { force: true, silent: true });
  }

  /** Requests an immediate one-off probe run. The scheduler dispatches asynchronously. */
  async function runService(serviceId: string): Promise<ActionResult> {
    const res = await http.post<{ ok: boolean }>(`/services/${serviceId}/run`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true };
  }

  function applyUpdateResponse(
    serviceId: string,
    updated: ServiceSummary | undefined,
    message: string | undefined,
  ): ActionDataResult<ServiceSummary> {
    if (!updated) {
      return { ok: false, message };
    }
    updateInPlace(serviceId, updated);
    return { ok: true, data: updated };
  }

  /** Replaces a service in its category, preserving enriched fields the update may lack. */
  function updateInPlace(serviceId: string, updated: ServiceSummary) {
    updateServiceInPlace(categories, serviceId, updated);
  }

  /** Applies an incremental metric update from a live probe.completed event. */
  function applyProbeResult(
    serviceId: string,
    status: string,
    avgResponseMs: number,
    failedAssertions?: FailedAssertion[],
  ) {
    applyProbeToBuckets(categories, serviceId, status, avgResponseMs, failedAssertions);
  }

  /** Allowed agent slugs (empty = all agents, the default). */
  async function fetchAllowedAgents(serviceId: string): Promise<ActionDataResult<string[]>> {
    const res = await http.get<string[]>(`/services/${serviceId}/agents`, { disableLoading: true });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data };
  }

  /** Replaces the allowed-agent set; empty restores "all agents". */
  async function setAllowedAgents(serviceId: string, slugs: string[]): Promise<ActionDataResult<string[]>> {
    const res = await http.put<string[], { slugs: string[] }>(`/services/${serviceId}/agents`, { slugs });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data };
  }

  function clear() {
    for (const category of SERVICE_CATEGORIES) {
      categories[category].items = [];
      categories[category].total = 0;
    }
    fetchedKey.value = null;
  }

  return {
    categories, services, totalResults, loading, isFullPage, aggregatedMetrics,
    ensureContext, fetchServices, fetchService, refreshService,
    createService, deleteService, updateServiceConfig, updateScript, toggleService,
    toggleServicesInScope, runService,
    updateInPlace, applyProbeResult, fetchAllowedAgents, setAllowedAgents, clear,
  };
});
