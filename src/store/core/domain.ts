import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import type {
  CreateDomainRequest, DnsHandoff, DomainSummary, VerifyDomainResponse,
} from '@/data/domains/DomainDto';
import type { ActionDataResult, ActionResult } from '@/types/actions';
import type { Page } from '@/types/pfs';

/** Org-owned domains and their ownership verification. */
export const useDomainStore = defineStore('domain', () => {
  const domains = ref<DomainSummary[]>([]);
  const loading = ref<boolean>(false);

  async function fetchDomains(): Promise<ActionResult> {
    loading.value = true;
    try {
      const res = await http.get<Page<DomainSummary>>('/domains?pageSize=100');
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      domains.value = res.data.items;
      return { ok: true };
    } finally {
      loading.value = false;
    }
  }

  async function createDomain(request: CreateDomainRequest): Promise<ActionDataResult<DomainSummary>> {
    const res = await http.post<DomainSummary, CreateDomainRequest>('/domains', request);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    domains.value = [...domains.value, res.data];
    return { ok: true, data: res.data };
  }

  /** Reflects a passed check in the list without a refetch. */
  function markVerified(domainId: string) {
    domains.value = domains.value.map(d =>
      d.id === domainId ? { ...d, status: 'verified', lapsed: false } : d);
  }

  /**
   * Re-checks the challenge. `silent` is for background polling — a check the
   * user did not ask for has no business raising the app-wide loading state.
   */
  async function verifyDomain(
    domainId: string,
    options?: { silent?: boolean },
  ): Promise<ActionDataResult<VerifyDomainResponse>> {
    const res = await http.post<VerifyDomainResponse, Record<string, never>>(
      `/domains/${domainId}/verify`,
      {},
      { disableLoading: options?.silent },
    );
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    if (res.data.verified) markVerified(domainId);
    return { ok: true, data: res.data };
  }

  /** Where this domain's DNS records are edited, when we recognise the provider. */
  async function fetchDnsHandoff(domainId: string): Promise<ActionDataResult<DnsHandoff>> {
    const res = await http.get<DnsHandoff>(`/domains/${domainId}/dns-handoff`, { disableLoading: true });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data };
  }

  async function setWildcard(domainId: string, wildcardEnabled: boolean): Promise<ActionResult> {
    const res = await http.patch<DomainSummary, { wildcardEnabled: boolean }>(`/domains/${domainId}`, { wildcardEnabled });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    const updated = res.data;
    domains.value = domains.value.map(d => (d.id === domainId ? updated : d));
    return { ok: true };
  }

  async function deleteDomain(domainId: string): Promise<ActionResult> {
    const res = await http.delete<{ ok: boolean }>(`/domains/${domainId}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    domains.value = domains.value.filter(d => d.id !== domainId);
    return { ok: true };
  }

  return {
    domains, loading, fetchDomains, createDomain, verifyDomain, setWildcard, deleteDomain,
    markVerified, fetchDnsHandoff,
  };
});
