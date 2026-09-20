import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useI18n } from 'vue-i18n';
import { checkFeature } from '@/config/extensions';
import { featureGateState, type FeatureGateState } from '@/lib/featureGate';
import { useOrgStore } from '@/store/core/org';

/**
 * Reactive state of one feature gate for the current organization. Call at
 * setup top level:
 *
 * ```ts
 * const createGate = useFeatureGate('domain.create');
 * ```
 *
 * and bind `createGate.enabled` / `createGate.hint` on the control. With no
 * host gate registered it is open and the hint is empty, so the control renders
 * exactly as it did before. The predicate runs on every read, so a gate that
 * consults reactive state re-decides on its own.
 */
export function useFeatureGate(feature: MaybeRefOrGetter<string>): ComputedRef<FeatureGateState> {
  const { t } = useI18n();
  const orgStore = useOrgStore();
  return computed(() => featureGateState(
    checkFeature(toValue(feature), { orgId: orgStore.selectedOrgId }),
    t('common.actionUnavailable'),
  ));
}
