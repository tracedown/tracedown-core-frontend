import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ProjectSummary } from '@/data/projects/ProjectDto';
import type { MetricsDelta } from '@/data/metrics/MetricsDto';

vi.mock('@/config/requests', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const { useProjectStore } = await import('@/store/core/project');

function delta(partial: Partial<MetricsDelta>): MetricsDelta {
  return { total: 0, success: 0, failure: 0, timeout: 0, sumMs: 0, callCount: 0, ...partial };
}

describe('project store: applyMetricsDelta', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function storeWithProject() {
    const store = useProjectStore();
    store.projects = [
      { id: 'p1', workspaceId: 'w1', name: 'proj', createdAt: '', metrics: null, serviceCount: 1 } as ProjectSummary,
    ];
    return store;
  }

  it('paints a delta made only of error runs as error, not green', () => {
    const store = storeWithProject();
    store.applyMetricsDelta('p1', delta({ total: 2, error: 2 }));
    expect(store.projects[0].metrics?.state.lastStatus).toBe('error');
  });

  it('derives the error count from the total when the server does not send it', () => {
    const store = storeWithProject();
    store.applyMetricsDelta('p1', delta({ total: 3, success: 2 }));
    expect(store.projects[0].metrics?.state.lastStatus).toBe('error');
  });

  it('ranks failure above error above timeout', () => {
    const store = storeWithProject();
    store.applyMetricsDelta('p1', delta({ total: 2, failure: 1, error: 1 }));
    expect(store.projects[0].metrics?.state.lastStatus).toBe('failure');
    store.applyMetricsDelta('p1', delta({ total: 2, timeout: 1, error: 1 }));
    expect(store.projects[0].metrics?.state.lastStatus).toBe('error');
    store.applyMetricsDelta('p1', delta({ total: 2, timeout: 1, success: 1 }));
    expect(store.projects[0].metrics?.state.lastStatus).toBe('timeout');
  });
});
