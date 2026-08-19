import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { defaultPfsParams, pfsToQueryString } from '@/utils/pfs';
import type { Page } from '@/types/pfs';
import type { ProbeResultDetail, ProbeResultSummary, StepBodyResponse } from '@/data/results/ResultDto';
import type { ActionResult } from '@/types/actions';

/** Probe results, detail and step bodies of the inspected service. */
export const useResultStore = defineStore('result', () => {
  const results = ref<ProbeResultSummary[]>([]);
  const totalResults = ref<number>(0);
  const loading = ref<boolean>(false);
  const selectedResult = ref<ProbeResultDetail | null>(null);
  const selectedResultLoading = ref<boolean>(false);
  const stepBody = ref<string | null>(null);
  const stepBodyLoading = ref<boolean>(false);

  async function fetchResults(serviceId: string, page = 1, pageSize = 50): Promise<ActionResult> {
    loading.value = true;
    try {
      const pfs = defaultPfsParams({ page, pageSize });
      const res = await http.get<Page<ProbeResultSummary>>(
        `/services/${serviceId}/results${pfsToQueryString(pfs)}`,
      );
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      results.value = res.data.items;
      totalResults.value = res.data.total;
      return { ok: true };
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetches recent results and prepends any new ones not already in the list.
   * Trims the list to pageSize. Used by live updates when the results panel is open.
   */
  async function prependNewResults(serviceId: string, pageSize: number, fetchCount = 5) {
    const pfs = defaultPfsParams({ page: 1, pageSize: fetchCount });
    const res = await http.get<Page<ProbeResultSummary>>(
      `/services/${serviceId}/results${pfsToQueryString(pfs)}`,
      { disableLoading: true },
    );
    if (!res.success || !res.data) return;

    const existingIds = new Set(results.value.map(r => r.id));
    const fresh = res.data.items.filter(r => !existingIds.has(r.id));
    if (fresh.length === 0) return;

    results.value = [...fresh, ...results.value].slice(0, pageSize);
    totalResults.value = res.data.total;
  }

  async function fetchResultDetail(serviceId: string, resultId: string): Promise<ActionResult> {
    selectedResultLoading.value = true;
    try {
      const res = await http.get<ProbeResultDetail>(
        `/services/${serviceId}/results/${resultId}`,
      );
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      selectedResult.value = res.data;
      return { ok: true };
    } finally {
      selectedResultLoading.value = false;
    }
  }

  async function fetchStepBody(serviceId: string, resultId: string, stepId: string) {
    stepBodyLoading.value = true;
    stepBody.value = null;
    try {
      const res = await http.get<StepBodyResponse>(
        `/services/${serviceId}/results/${resultId}/steps/${stepId}/body`,
      );
      // Object-storage bodies arrive as a presigned URL fetched directly —
      // plain fetch, deliberately: the page's own origin must reach the
      // bucket (its CORS policy is scoped to it), and the session token must
      // never be sent to the storage host.
      if (res.data?.url) {
        try {
          const remote = await fetch(res.data.url);
          stepBody.value = remote.ok ? await remote.text() : null;
        } catch {
          stepBody.value = null;
        }
      } else {
        stepBody.value = res.data?.content ?? null;
      }
    } finally {
      stepBodyLoading.value = false;
    }
  }

  function clearStepBody() {
    stepBody.value = null;
  }

  function clearSelection() {
    selectedResult.value = null;
    stepBody.value = null;
  }

  function clearResults() {
    results.value = [];
    totalResults.value = 0;
    clearSelection();
  }

  function clear() {
    clearResults();
  }

  return {
    results, totalResults, loading, selectedResult, selectedResultLoading,
    stepBody, stepBodyLoading,
    fetchResults, prependNewResults, fetchResultDetail, fetchStepBody,
    clearStepBody, clearSelection, clearResults, clear,
  };
});
