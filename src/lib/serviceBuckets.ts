import { applyProbeToMetrics } from '@/lib/metrics-utils';
import { SERVICE_CATEGORIES, categoryForStatus } from '@/utils/serviceCategories';
import type { ServiceCategory, ServiceCategoryState } from '@/types/services';
import type { FailedAssertion, ServiceSummary } from '@/data/services/ServiceDto';

/**
 * Pure category-bucket mechanics behind the service store: services live in
 * one of three status buckets (failed / new / healthy) and move between them
 * as probe results arrive. No HTTP — every function manipulates the passed-in
 * buckets record in place.
 */

export type ServiceBuckets = Record<ServiceCategory, ServiceCategoryState>;

/** Position of a service within the buckets. */
export interface BucketPosition {
  category: ServiceCategory;
  index: number;
}

/** Locates a service across all buckets. */
export function findService(buckets: ServiceBuckets, serviceId: string): BucketPosition | null {
  for (const category of SERVICE_CATEGORIES) {
    const index = buckets[category].items.findIndex(s => s.id === serviceId);
    if (index !== -1) return { category, index };
  }
  return null;
}

/** Writes the row back, moving it between lists when its bucket changed. */
export function placeService(
  buckets: ServiceBuckets,
  found: BucketPosition,
  updated: ServiceSummary,
) {
  const newCategory = categoryForStatus(updated.lastStatus);
  if (newCategory === found.category) {
    buckets[found.category].items[found.index] = updated;
  } else {
    buckets[found.category].items.splice(found.index, 1);
    buckets[found.category].total--;
    buckets[newCategory].items.unshift(updated);
    buckets[newCategory].total++;
  }
}

/** How a payload reached [updateServiceInPlace]. */
export interface UpdateOrigin {
  /**
   * The payload is the single-service read. That response is the only one
   * that evaluates `unverifiedTargets`; every other — a list row, an update
   * or a toggle response — reports it empty whether or not targets are
   * unverified, so only this one may clear it.
   */
  fromDetail?: boolean;
}

/**
 * Replaces a service in its bucket, preserving enriched fields the update may
 * lack, and never moving the row backwards.
 *
 * `version` is the service's own revision counter, so an incoming payload that
 * carries a lower one was read before the copy already held and describes a
 * service that no longer exists. Writing it would undo a save the user has
 * already been told succeeded — and the first save of a service is the worst
 * case, because the copy it would restore has no script at all.
 *
 * Equal versions are written through: a toggle changes `isActive` without
 * bumping the revision.
 */
export function updateServiceInPlace(
  buckets: ServiceBuckets,
  serviceId: string,
  updated: ServiceSummary,
  origin: UpdateOrigin = {},
) {
  const found = findService(buckets, serviceId);
  if (!found) return;
  const existing = buckets[found.category].items[found.index];
  if (updated.version < existing.version) return;
  placeService(buckets, found, {
    ...updated,
    metrics: updated.metrics ?? existing.metrics,
    // A successful service HAS no failure — never resurrect the old one.
    // On failure, payloads without enrichment keep the known preview.
    lastFailure: updated.lastStatus === 'success'
      ? null
      : updated.lastFailure ?? existing.lastFailure,
    unverifiedTargets: origin.fromDetail ? updated.unverifiedTargets : existing.unverifiedTargets,
  });
}

/**
 * Applies an incremental metric update from a live probe.completed event.
 * Builds a new service object (reactivity via index assignment) and moves it
 * between buckets when the status bucket changed.
 */
export function applyProbeResult(
  buckets: ServiceBuckets,
  serviceId: string,
  status: string,
  avgResponseMs: number,
  failedAssertions?: FailedAssertion[],
) {
  const found = findService(buckets, serviceId);
  if (!found) return;
  const old = buckets[found.category].items[found.index];

  const statusChanged = old.lastStatus !== status;
  const updated: ServiceSummary = {
    ...old,
    lastStatus: status,
    lastStatusSince: statusChanged ? new Date().toISOString() : old.lastStatusSince,
    lastFailure: status === 'success'
      ? null
      : failedAssertions?.length
        ? { assertions: failedAssertions }
        : old.lastFailure,
    metrics: applyProbeToMetrics(old.metrics, status, avgResponseMs),
  };

  placeService(buckets, found, updated);
}
