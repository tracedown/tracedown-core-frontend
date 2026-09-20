import { describe, expect, it } from 'vitest';
import { checkFeature, isFeatureEnabled, registerFeatureGate } from '@/config/extensions';
import { featureGateState, variableCreateGate } from '@/lib/featureGate';

// The registry is a module singleton with no reset — registration is a startup
// act, not a per-test one. Each case therefore uses a feature name of its own.
let counter = 0;
function feature(): string {
  counter += 1;
  return `test.feature.${counter}`;
}

describe('feature gates', () => {
  it('is open when nothing is registered', () => {
    expect(checkFeature(feature())).toEqual({ enabled: true, reason: null });
  });

  it('is open while every gate allows it', () => {
    const name = feature();
    registerFeatureGate(name, () => true);
    registerFeatureGate(name, () => ({ enabled: true }));
    expect(isFeatureEnabled(name)).toBe(true);
  });

  it('closes on a bare veto, with no reason of its own', () => {
    const name = feature();
    registerFeatureGate(name, () => false);
    expect(checkFeature(name)).toEqual({ enabled: false, reason: null });
  });

  it('carries the reason a veto supplies', () => {
    const name = feature();
    registerFeatureGate(name, () => ({ enabled: false, reason: 'Ask an owner.' }));
    expect(checkFeature(name)).toEqual({ enabled: false, reason: 'Ask an owner.' });
  });

  it('reports the first veto, so one gate cannot overwrite another’s reason', () => {
    const name = feature();
    registerFeatureGate(name, () => ({ enabled: false, reason: 'first' }));
    registerFeatureGate(name, () => ({ enabled: false, reason: 'second' }));
    expect(checkFeature(name).reason).toBe('first');
  });

  it('passes the subject to every gate', () => {
    const name = feature();
    const seen: (string | null | undefined)[] = [];
    registerFeatureGate(name, (context) => {
      seen.push(context.orgId);
      return true;
    });
    isFeatureEnabled(name, { orgId: 'org-1' });
    isFeatureEnabled(name);
    expect(seen).toEqual(['org-1', undefined]);
  });

  it('decides per subject', () => {
    const name = feature();
    registerFeatureGate(name, ({ orgId }) => orgId !== 'closed-org');
    expect(isFeatureEnabled(name, { orgId: 'open-org' })).toBe(true);
    expect(isFeatureEnabled(name, { orgId: 'closed-org' })).toBe(false);
  });
});

describe('featureGateState', () => {
  it('leaves an open control without a hint', () => {
    expect(featureGateState({ enabled: true, reason: null }, 'fallback'))
      .toEqual({ enabled: true, hint: '' });
  });

  it('shows the veto’s own wording on a closed control', () => {
    expect(featureGateState({ enabled: false, reason: 'Ask an owner.' }, 'fallback'))
      .toEqual({ enabled: false, hint: 'Ask an owner.' });
  });

  it('falls back to the generic wording, never to an empty hint', () => {
    expect(featureGateState({ enabled: false, reason: null }, 'fallback'))
      .toEqual({ enabled: false, hint: 'fallback' });
  });
});

describe('variableCreateGate', () => {
  it('names one gate per scope of the hierarchy', () => {
    expect([
      variableCreateGate('org'),
      variableCreateGate('workspace'),
      variableCreateGate('project'),
      variableCreateGate('service'),
    ]).toEqual([
      'organization.variable.create',
      'workspace.variable.create',
      'project.variable.create',
      'service.variable.create',
    ]);
  });
});
