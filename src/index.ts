// Public package API for host overlays. A consuming application builds ON TOP of
// this package via bootstrapApp + the extension registries — it never forks or
// re-implements the source.

export { bootstrapApp } from '@/app/bootstrap';
export type { BootstrapOptions } from '@/types/bootstrap';

// Adopt an externally-minted session token (host-driven auto-login).
export { establishSession } from '@/app/session';

export {
  registerSlot,
  getSlotComponents,
  slotIsFilled,
  setScriptEditor,
  registerFeatureGate,
  isFeatureEnabled,
  registerDeleteOrgHandler,
  registerDataExportContributor,
} from '@/config/extensions';
export type {
  FeatureContext,
  DeleteOrgCredentials,
  DeleteOrgHandler,
  DataExportContributor,
} from '@/config/extensions';

export { registerPermissionSections, getPermissionSections } from '@/config/permissionSections';
export { DEFAULT_NAV_ITEMS } from '@/config/navigation';
export { useNavigationStore } from '@/store/ui/navigation';

// The configured API client and stores host overlays extend around.
export { http } from '@/config/requests';
export { useOrgStore } from '@/store/core/org';
// A host that places a domain's DNS record its own way reflects the result
// through this store, so the domains list updates without a refetch.
export { useDomainStore } from '@/store/core/domain';

export type { DomainSummary } from '@/data/domains/DomainDto';
export type { NavItem } from '@/types/ui/navigation';
export type { PermissionSectionDef, AccessSection } from '@/types/access';
export type { ActionResult, ActionDataResult } from '@/types/actions';
