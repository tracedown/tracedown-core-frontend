import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { defaultPfsParams, pfsToQueryString } from '@/utils/pfs';
import { bodyToBlob } from '@/utils/resultBodies';
import type { Page } from '@/types/pfs';
import type { ProbeResultDetail, ProbeResultSummary, StepBodyResponse } from '@/data/results/ResultDto';
import type { ActionDataResult, ActionResult } from '@/types/actions';

/** Probe results, detail and step bodies of the inspected service. */
export const useResultStore = defineStore('result', () => {
  const results = ref<ProbeResultSummary[]>([]);
  const totalResults = ref<number>(0);
  const loading = ref<boolean>(false);
  const selectedResult = ref<ProbeResultDetail | null>(null);
  const selectedResultLoading = ref<boolean>(false);
  const stepBody = ref<string | null>(null);
  const stepBodyLoading = ref<boolean>(false);
  /** The last body fetch failed; the message is the server's (already resolved) when it gave one. */
  const stepBodyFailed = ref<boolean>(false);
  const stepBodyError = ref<string | null>(null);
  /** `base64` when the body is bytes, not text — the view says so instead of rendering it. */
  const stepBodyEncoding = ref<'base64' | null>(null);
  const stepBodyContentType = ref<string | null>(null);

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
   * The page of the history on which results started at or before `at` (an
   * ISO instant) begin, for the given page size. Lets the pager jump to a
   * date while keeping the list unfiltered.
   */
  async function pageAt(serviceId: string, at: string, pageSize: number): Promise<ActionDataResult<number>> {
    const res = await http.get<{ page: number; total: number }>(
      `/services/${serviceId}/results/page-at?at=${encodeURIComponent(at)}&pageSize=${pageSize}`,
    );
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data.page };
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
    stepBodyFailed.value = false;
    stepBodyError.value = null;
    stepBodyEncoding.value = null;
    stepBodyContentType.value = null;
    try {
      const res = await http.get<StepBodyResponse>(
        `/services/${serviceId}/results/${resultId}/steps/${stepId}/body`,
      );
      // A refusal (the body is gone from where it was kept, storage is
      // unreachable) is said out loud rather than rendered as an empty body.
      if (!res.success) {
        stepBodyFailed.value = true;
        stepBodyError.value = res.errorInfo?.message ?? null;
        return;
      }
      // Object-storage bodies arrive as a presigned URL fetched directly —
      // plain fetch, deliberately: the page's own origin must reach the
      // bucket (its CORS policy is scoped to it), and the session token must
      // never be sent to the storage host.
      if (res.data?.url) {
        try {
          const remote = await fetch(res.data.url);
          if (remote.ok) {
            stepBody.value = await remote.text();
          } else {
            stepBodyFailed.value = true;
          }
        } catch {
          stepBodyFailed.value = true;
        }
      } else {
        stepBody.value = res.data?.content ?? null;
        stepBodyEncoding.value = res.data?.encoding ?? null;
        stepBodyContentType.value = res.data?.contentType ?? null;
      }
    } finally {
      stepBodyLoading.value = false;
    }
  }

  /**
   * Fetches a step's body as the exact bytes the check received, for saving to
   * a file.
   *
   * Deliberately separate from [fetchStepBody] and deliberately writes none of
   * its state. This is the path a body too big to display takes, and putting
   * tens of megabytes into a reactive ref — where every render would hold it,
   * and Vue would have it under a proxy — to then hand it straight to a
   * download is the wrong shape. Object-storage bodies go from the socket into
   * a Blob without ever becoming a JavaScript string.
   */
  async function fetchStepBodyBlob(
    serviceId: string,
    resultId: string,
    stepId: string,
  ): Promise<ActionDataResult<{ blob: Blob; contentType: string | null; encoding: 'base64' | null }>> {
    const res = await http.get<StepBodyResponse>(
      `/services/${serviceId}/results/${resultId}/steps/${stepId}/body`,
      { disableLoading: true },
    );
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    const contentType = res.data?.contentType ?? null;
    // Presigned object-storage URL — fetched directly, same reasoning as the
    // display path: the bucket's CORS is scoped to this origin, and the
    // session token must never reach the storage host.
    if (res.data?.url) {
      try {
        const remote = await fetch(res.data.url);
        if (!remote.ok) return { ok: false };
        return { ok: true, data: { blob: await remote.blob(), contentType, encoding: null } };
      } catch {
        return { ok: false };
      }
    }
    const content = res.data?.content;
    if (content == null) return { ok: false };
    const encoding = res.data?.encoding ?? null;
    return {
      ok: true,
      data: { blob: bodyToBlob(content, encoding, contentType), contentType, encoding },
    };
  }

  function clearStepBody() {
    stepBody.value = null;
    stepBodyFailed.value = false;
    stepBodyError.value = null;
    stepBodyEncoding.value = null;
    stepBodyContentType.value = null;
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
    stepBody, stepBodyLoading, stepBodyFailed, stepBodyError, stepBodyEncoding, stepBodyContentType,
    fetchResults, pageAt, prependNewResults, fetchResultDetail, fetchStepBody, fetchStepBodyBlob,
    clearStepBody, clearSelection, clearResults, clear,
  };
});
