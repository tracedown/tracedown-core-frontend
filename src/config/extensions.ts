import { defineAsyncComponent, type Component } from 'vue';
import LoadingSpinner from '@/components/core/LoadingSpinner.vue';
import type { ActionResult } from '@/types/actions';

/**
 * In-memory extension registry. A host application can register additional
 * components, swap built-in pieces, or override behaviors before the app is
 * mounted (see `bootstrapApp`'s `onSetup`). The app itself never registers
 * anything here — the built-in defaults are the un-extended behavior.
 *
 * This is a plain module singleton: registration happens once at startup,
 * before mount, so no reactivity or store is needed.
 */

// ── Named component slots ────────────────────────────────────────────────────

const slotComponents = new Map<string, Component[]>();

/** Register a component to render in the named slot. Multiple are allowed. */
export function registerSlot(name: string, component: Component): void {
  const existing = slotComponents.get(name);
  if (existing) {
    existing.push(component);
  } else {
    slotComponents.set(name, [component]);
  }
}

/** Components registered for a slot, in registration order (empty if none). */
export function getSlotComponents(name: string): Component[] {
  return slotComponents.get(name) ?? [];
}

/**
 * Whether a host has taken over a slot. Lets a built-in surface stand down in
 * favour of a host's richer replacement, instead of the two rendering side by
 * side and offering the user the same thing twice.
 */
export function slotIsFilled(name: string): boolean {
  return getSlotComponents(name).length > 0;
}

// ── Script editor ────────────────────────────────────────────────────────────

/**
 * Built-in script editor. CodeMirror and the Lace tooling dominate the chunk,
 * so it loads on demand — the host view renders without waiting for it.
 */
const defaultScriptEditor: Component = defineAsyncComponent({
  loader: () => import('@/components/core/editor/LaceEditor.vue'),
  loadingComponent: LoadingSpinner,
});

let scriptEditor: Component | null = null;

/** Replace the built-in script editor with a host-provided component. */
export function setScriptEditor(component: Component): void {
  scriptEditor = component;
}

/** The registered script editor, or the built-in default. */
export function getScriptEditor(): Component {
  return scriptEditor ?? defaultScriptEditor;
}

// ── Feature gates ────────────────────────────────────────────────────────────

/**
 * Context a feature check is evaluated against. Availability is decided per
 * subject (e.g. per organization), never as one global switch — the caller
 * passes whose availability it is asking about.
 */
export interface FeatureContext {
  /** The organization the check applies to (the current org, if any). */
  orgId?: string | null;
}

type FeatureGatePredicate = (context: FeatureContext) => boolean;

const featureGates = new Map<string, FeatureGatePredicate[]>();

/**
 * Register a predicate that decides whether a named feature is available for a
 * given context. A feature is enabled unless at least one registered predicate
 * returns false, so any host module can veto it. The predicate is evaluated on
 * every check — read reactive state inside it and callers that run in a
 * computed stay reactive.
 */
export function registerFeatureGate(feature: string, predicate: FeatureGatePredicate): void {
  const existing = featureGates.get(feature);
  if (existing) {
    existing.push(predicate);
  } else {
    featureGates.set(feature, [predicate]);
  }
}

/**
 * Whether a feature is available for the given context. True when no gate
 * vetoes it (the default). Pass the subject (e.g. `{ orgId }`) so the decision
 * is per-tenant, not a single global toggle.
 */
export function isFeatureEnabled(feature: string, context: FeatureContext = {}): boolean {
  const gates = featureGates.get(feature);
  if (!gates) return true;
  return gates.every(gate => gate(context));
}

// ── Delete-org handler ───────────────────────────────────────────────────────

let deleteOrgHandler: (() => Promise<ActionResult>) | null = null;

/** Override the org-deletion action with host-provided behaviour. */
export function registerDeleteOrgHandler(fn: () => Promise<ActionResult>): void {
  deleteOrgHandler = fn;
}

/** The registered handler, or null to use the built-in deletion path. */
export function getDeleteOrgHandler(): (() => Promise<ActionResult>) | null {
  return deleteOrgHandler;
}
