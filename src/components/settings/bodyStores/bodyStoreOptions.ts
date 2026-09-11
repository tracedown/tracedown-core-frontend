import type { BodyStoreSummary } from '@/data/bodyStores/BodyStoreDto';
import type { SelectOption } from '@/types/ui/common';

/** Select value standing for the default store (which has no id — it is null on the wire). */
export const DEFAULT_OPTION = '';

/** Store picker options: the default store first, then the configured stores by name. */
export function bodyStoreOptions(stores: BodyStoreSummary[], defaultLabel: string): SelectOption[] {
  return [
    { value: DEFAULT_OPTION, label: defaultLabel },
    ...[...stores]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(store => ({ value: store.id, label: store.name })),
  ];
}
