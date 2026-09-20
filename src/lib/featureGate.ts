import type { FeatureDecision } from '@/config/extensions';
import type { VariableScopeName } from '@/data/variables/VariableDto';

/**
 * How a control gated by a feature renders: enabled, or disabled carrying the
 * text that explains it. A disabled control with nothing to read is a dead end,
 * so `hint` is never empty while `enabled` is false.
 */
export interface FeatureGateState {
  enabled: boolean;
  /** Empty while open; the veto's own wording, or `fallback`, while closed. */
  hint: string;
}

/**
 * Turns a gate decision into that presentation state. `fallback` is the app's
 * generic wording, used when the veto gave none of its own.
 */
export function featureGateState(decision: FeatureDecision, fallback: string): FeatureGateState {
  if (decision.enabled) return { enabled: true, hint: '' };
  return { enabled: false, hint: decision.reason ?? fallback };
}

/** Variable-create gate keys, one per scope of the hierarchy. */
const VARIABLE_CREATE_GATES: Record<VariableScopeName, string> = {
  org: 'organization.variable.create',
  workspace: 'workspace.variable.create',
  project: 'project.variable.create',
  service: 'service.variable.create',
};

/**
 * The gate that closes variable creation at one scope. Each scope has its own
 * key: a host may hold a workspace open while closing the service below it.
 */
export function variableCreateGate(scope: VariableScopeName): string {
  return VARIABLE_CREATE_GATES[scope];
}
