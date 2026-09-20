import { describe, expect, it } from 'vitest';
import { updateServiceInPlace } from '@/lib/serviceBuckets';
import type { ServiceBuckets } from '@/lib/serviceBuckets';
import type { ServiceSummary } from '@/data/services/ServiceDto';

function service(overrides: Partial<ServiceSummary> = {}): ServiceSummary {
  return {
    id: 'svc-1',
    projectId: 'proj-1',
    name: 'checkout',
    label: null,
    script: 'get("https://api.example.com/health")',
    schedule: '*/5 * * * *',
    probeMode: 'consecutive',
    queuePolicy: 'skip',
    serviceWindow: null,
    saveResponseBodies: true,
    unverifiedTargets: [],
    isActive: true,
    lastStatus: 'success',
    lastStatusSince: '2026-01-01T00:00:00Z',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    metrics: null,
    lastFailure: null,
    ...overrides,
  };
}

/** Seeds the bucket the service's own status puts it in. */
function bucketsWith(item: ServiceSummary): ServiceBuckets {
  const bucket = item.lastStatus === null ? 'new'
    : item.lastStatus === 'success' ? 'healthy'
      : 'failed';
  const buckets: ServiceBuckets = {
    failed: { items: [], total: 0 },
    new: { items: [], total: 0 },
    healthy: { items: [], total: 0 },
  };
  buckets[bucket] = { items: [item], total: 1 };
  return buckets;
}

/** The one service across all buckets. */
const stored = (buckets: ServiceBuckets) =>
  [...buckets.failed.items, ...buckets.new.items, ...buckets.healthy.items][0];

describe('updateServiceInPlace', () => {
  it('writes a newer revision through', () => {
    const buckets = bucketsWith(service());
    updateServiceInPlace(buckets, 'svc-1', service({ version: 2, name: 'checkout-v2' }));
    expect(stored(buckets).name).toBe('checkout-v2');
    expect(stored(buckets).version).toBe(2);
  });

  it('writes an equal revision through — a toggle does not bump the version', () => {
    const buckets = bucketsWith(service({ isActive: true }));
    updateServiceInPlace(buckets, 'svc-1', service({ isActive: false }));
    expect(stored(buckets).isActive).toBe(false);
  });

  /**
   * The bug this guards: a saved script came back as an empty editor.
   *
   * The open service holds a channel snapshot taken when the panel opened. A
   * probe result patches only the recent-probe list of that snapshot, so its
   * copy of the service — the one from before the save — is carried along
   * unchanged, and used to be written back over the saved one. On a service
   * saved for the first time the pre-save copy has no script at all, so the
   * next edit opened empty and stayed empty until the page was reloaded.
   */
  it('refuses to put an older revision back over a newer one', () => {
    const buckets = bucketsWith(service({ version: 2, script: 'get("https://api.example.com/v2")' }));
    updateServiceInPlace(buckets, 'svc-1', service({ version: 1, script: '' }));
    expect(stored(buckets).script).toBe('get("https://api.example.com/v2")');
    expect(stored(buckets).version).toBe(2);
  });

  it('keeps the metrics and failure preview a lean payload cannot carry', () => {
    const metrics = { uptime: 99.9 } as unknown as ServiceSummary['metrics'];
    const lastFailure = { assertions: [{ scope: 'status', expected: '200', actual: '503' }] };
    const buckets = bucketsWith(service({ lastStatus: 'failure', metrics, lastFailure }));
    updateServiceInPlace(buckets, 'svc-1', service({ version: 2, lastStatus: 'failure' }));
    expect(stored(buckets).metrics).toBe(metrics);
    expect(stored(buckets).lastFailure).toEqual(lastFailure);
  });

  it('drops the failure preview once the service succeeds', () => {
    const lastFailure = { assertions: [{ scope: 'status', expected: '200', actual: '503' }] };
    const buckets = bucketsWith(service({ lastStatus: 'failure', lastFailure }));
    updateServiceInPlace(buckets, 'svc-1', service({ version: 2, lastStatus: 'success' }));
    expect(stored(buckets).lastFailure).toBeNull();
  });

  /**
   * Only the single-service read evaluates the target list; every other
   * payload reports it empty whether or not targets are unverified. An empty
   * one from an update response must not unlock the body-saving switch that
   * the scheduler overrides anyway.
   */
  it('keeps the unverified targets an update response cannot carry', () => {
    const buckets = bucketsWith(service({ unverifiedTargets: ['api.example.com'] }));
    updateServiceInPlace(buckets, 'svc-1', service({ version: 2, unverifiedTargets: [] }));
    expect(stored(buckets).unverifiedTargets).toEqual(['api.example.com']);
  });

  it('lets a detail read clear the unverified targets once the domain is verified', () => {
    const buckets = bucketsWith(service({ unverifiedTargets: ['api.example.com'] }));
    updateServiceInPlace(buckets, 'svc-1', service({ version: 2, unverifiedTargets: [] }), { fromDetail: true });
    expect(stored(buckets).unverifiedTargets).toEqual([]);
  });

  it('ignores a service it does not hold', () => {
    const buckets = bucketsWith(service());
    updateServiceInPlace(buckets, 'other', service({ id: 'other', name: 'nope' }));
    expect(stored(buckets).name).toBe('checkout');
    expect(buckets.healthy.items).toHaveLength(1);
  });
});
