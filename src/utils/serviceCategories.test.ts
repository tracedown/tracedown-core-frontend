import { describe, expect, it } from 'vitest';
import { CATEGORY_STATUS_FILTERS, SERVICE_CATEGORIES, categoryForStatus } from './serviceCategories';

/** Every status the backend can write to `services.last_status` (its `services_last_status_check` constraint). */
const BACKEND_STATUSES = ['success', 'failure', 'timeout', 'error'];

describe('serviceCategories', () => {
  it('fetches every backend status under exactly one category', () => {
    // The list is fetched per category with these server-side filters, so a
    // status no filter selects is a service that silently vanishes from the
    // list — `error` did.
    for (const status of BACKEND_STATUSES) {
      const selecting = SERVICE_CATEGORIES.filter((category) => {
        const { operator, value } = CATEGORY_STATUS_FILTERS[category];
        return operator === 'eq' ? value === status : value.split(',').includes(status);
      });
      expect(selecting, status).toEqual([categoryForStatus(status)]);
    }
  });

  it('files a service that never ran under new', () => {
    expect(categoryForStatus(null)).toBe('new');
    expect(CATEGORY_STATUS_FILTERS.new).toEqual({ operator: 'eq', value: '' });
  });
});
