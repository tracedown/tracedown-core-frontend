import type { FilterOperator } from '@/types/pfs';
import type { ServiceCategory } from '@/types/services';

/** Display order of the service list sections. */
export const SERVICE_CATEGORIES: ServiceCategory[] = ['new', 'failed', 'healthy'];

/**
 * PFS filter on `services.last_status` selecting each category:
 * `eq ""` → status IS NULL (never ran), `inList` → failure/timeout/error,
 * `eq success` → healthy. Together the filters must select every status the
 * backend can write (its `services_last_status_check` constraint: success,
 * failure, timeout, error), each under the category `categoryForStatus`
 * names — a status no filter selects is a service missing from the list.
 */
export const CATEGORY_STATUS_FILTERS: Record<ServiceCategory, { operator: FilterOperator; value: string }> = {
  new: { operator: 'eq', value: '' },
  failed: { operator: 'inList', value: 'failure,timeout,error' },
  healthy: { operator: 'eq', value: 'success' },
};

export function categoryForStatus(status: string | null): ServiceCategory {
  if (!status) return 'new';
  if (status === 'success') return 'healthy';
  return 'failed';
}
