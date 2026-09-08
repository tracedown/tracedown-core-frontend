import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { RouteLocationRaw } from 'vue-router';
import type { AccessSection } from '@/types/access';

/**
 * An entry of the navigation ribbon, registered into the navigation store at
 * startup (see `@/config/navigation`).
 */
export interface NavItem {
  /** Unique key for deduplication across registrations. */
  key: string;
  /** i18n key for the display label. */
  label: string;
  route: RouteLocationRaw;
  icon: IconDefinition;
  /** Permission sections the user needs read access to (ALL of them). Empty = no AND requirement. */
  access: AccessSection[];
  /** If set, the user must have read on AT LEAST ONE of these (in addition to `access`). */
  anyAccess?: AccessSection[];
  /**
   * Optional feature-gate key. When a host vetoes this feature, the item is
   * hidden. Enabled by default, so un-extended Core never hides it.
   */
  feature?: string;
  /** Sort order (lower = higher). Default 0. */
  order?: number;
  /**
   * Draws a divider above this item, splitting the ribbon into groups.
   *
   * `order` can put an item at the bottom but cannot say that it belongs
   * somewhere else — a trailing entry a host appends otherwise reads as one
   * more of the app's own destinations. Ignored on the first visible item,
   * where a rule would separate the list from nothing.
   */
  separatorBefore?: boolean;
}
