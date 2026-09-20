/**
 * Pure model builders for the two per-endpoint statistics panels.
 *
 * Everything the charts draw — which rows survive a filter, which bars a row
 * carries, which colour token each bar takes, how a template is shortened for
 * an axis label — is decided here, so the components stay Chart.js glue and the
 * decisions stay testable without a canvas.
 */

import { formatMs } from '@/lib/metrics-utils';
import type { EndpointPhases, EndpointStat } from '@/data/metrics/MetricsDto';

/** The phase segments of a response, in the order they happen. */
export const PHASE_KEYS = ['dns', 'connect', 'tls', 'ttfb', 'transfer'] as const;

export type PhaseKey = typeof PHASE_KEYS[number];

/** Status-code classes the code chart colours by. `0` is "the call got no answer at all". */
export type CodeTone = 'noResponse' | 'success' | 'redirect' | 'clientError' | 'serverError' | 'other';

const PHASE_FIELDS: Record<PhaseKey, keyof EndpointPhases> = {
  dns: 'dnsMs',
  connect: 'connectMs',
  tls: 'tlsMs',
  ttfb: 'ttfbMs',
  transfer: 'transferMs',
};

const PHASE_COLOR_VARS: Record<PhaseKey, string> = {
  dns: '--chart-phase-dns',
  connect: '--chart-phase-connect',
  tls: '--chart-phase-tls',
  ttfb: '--chart-phase-ttfb',
  transfer: '--chart-phase-transfer',
};

const TONE_COLOR_VARS: Record<CodeTone, string> = {
  // A call that never got an answer is worse than a 500 and is drawn that way:
  // its own deeper red, not a shade of the server-error bar beside it.
  noResponse: '--chart-no-response',
  success: '--chart-success',
  redirect: '--chart-dimmed',
  clientError: '--chart-warning',
  serverError: '--chart-failure',
  other: '--chart-dimmed',
};

/** Class of a status code. Anything outside 100–599 that is not `0` is `other`. */
export function codeTone(code: number): CodeTone {
  if (code === 0) return 'noResponse';
  if (code >= 200 && code < 300) return 'success';
  if (code >= 300 && code < 400) return 'redirect';
  if (code >= 400 && code < 500) return 'clientError';
  if (code >= 500 && code < 600) return 'serverError';
  return 'other';
}

/** CSS custom property that colours a status code's bar. */
export function codeColorVar(code: number): string {
  return TONE_COLOR_VARS[codeTone(code)];
}

/** CSS custom property that colours one phase segment. */
export function phaseColorVar(phase: PhaseKey): string {
  return PHASE_COLOR_VARS[phase];
}

// A leading `{…}` placeholder, or a literal scheme + host, only when a path
// follows it: `{p.baseUrl}/orders` shortens, a bare `{nextLink}` does not.
const LEADING_PLACEHOLDER = /^\{[^{}]*\}(?=\/)/;
const LEADING_ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/]+(?=\/)/i;

/**
 * The part of a template worth putting on an axis: the base-URL placeholder or
 * the literal origin dropped, then clipped from the left (a long path's tail is
 * what tells two endpoints apart).
 */
export function shortTemplate(template: string, maxLength = 40): string {
  const trimmed = template.trim();
  const short = trimmed.replace(LEADING_PLACEHOLDER, '').replace(LEADING_ORIGIN, '');
  const body = short.length > 0 ? short : trimmed;
  return body.length > maxLength ? `…${body.slice(body.length - maxLength + 1)}` : body;
}

/** Axis label for one endpoint: `GET /orders/{orderId}`. */
export function endpointLabel(endpoint: EndpointStat, maxLength?: number): string {
  return `${endpoint.method} ${shortTemplate(endpoint.template, maxLength)}`;
}

/** True when any endpoint answered with something other than a 2xx. */
export function hasNonSuccessCodes(endpoints: readonly EndpointStat[]): boolean {
  return endpoints.some(e => e.codes.some(c => codeTone(c.code) !== 'success'));
}

/** Codes ascending, `0` last — the order the API already uses, re-applied after a merge. */
function compareCodes(a: number, b: number): number {
  if (a === 0) return b === 0 ? 0 : 1;
  if (b === 0) return -1;
  return a - b;
}

/** One status code, as a bar across every endpoint row of the codes chart. */
export interface CodeSeries {
  code: number;
  colorVar: string;
  /** Call count per endpoint row, index-aligned with `rows`. */
  counts: number[];
  /** That count as a percentage of the row's total calls (0 when it made none). */
  shares: number[];
}

export interface EndpointCodesModel {
  /** The endpoints drawn, in API order. */
  rows: EndpointStat[];
  series: CodeSeries[];
}

/**
 * Codes-by-endpoint model.
 *
 * With `hideSuccess`, the 2xx bars go *and* so do the endpoints left with
 * nothing to show: on a linear axis 8,640 × 200 makes 9 × 503 invisible, and an
 * all-2xx endpoint then contributes an empty row to a chart that may already
 * carry twenty of them.
 */
export function buildEndpointCodesModel(
  endpoints: readonly EndpointStat[],
  hideSuccess: boolean,
): EndpointCodesModel {
  const visible = (code: number): boolean => !hideSuccess || codeTone(code) !== 'success';
  const rows = endpoints.filter(e => e.codes.some(c => visible(c.code)));

  const codes = [...new Set(rows.flatMap(e => e.codes.map(c => c.code).filter(visible)))]
    .sort(compareCodes);

  const series = codes.map<CodeSeries>(code => ({
    code,
    colorVar: codeColorVar(code),
    counts: rows.map(e => e.codes.find(c => c.code === code)?.count ?? 0),
    shares: rows.map((e) => {
      const count = e.codes.find(c => c.code === code)?.count ?? 0;
      return e.calls > 0 ? (count / e.calls) * 100 : 0;
    }),
  }));

  return { rows, series };
}

/** One phase, as a stacked segment across every endpoint row of the phases chart. */
export interface PhaseSeries {
  phase: PhaseKey;
  colorVar: string;
  /** Window average in ms per endpoint row. */
  values: number[];
  /** Change against the previous period, null where that period holds no data. */
  deltas: (number | null)[];
}

export interface EndpointPhasesModel {
  /** Endpoints that carry timings, in API order. */
  rows: EndpointStat[];
  series: PhaseSeries[];
  /** Sum of the previous period's segments per row — the marker position; null when unknown. */
  previousTotals: (number | null)[];
}

/** Sum of the five drawn segments. Not `responseMs`: the marker must match the bar. */
export function phaseTotal(phases: EndpointPhases): number {
  return PHASE_KEYS.reduce((sum, key) => sum + phases[PHASE_FIELDS[key]], 0);
}

/**
 * Phases-by-endpoint model. Endpoints with no timings at all are dropped from
 * this chart only — they still have codes to show in the other one.
 */
export function buildEndpointPhasesModel(endpoints: readonly EndpointStat[]): EndpointPhasesModel {
  const rows = endpoints.filter(e => e.phases !== null);
  const series = PHASE_KEYS.map<PhaseSeries>(phase => ({
    phase,
    colorVar: phaseColorVar(phase),
    values: rows.map(e => e.phases?.[PHASE_FIELDS[phase]] ?? 0),
    deltas: rows.map((e) => {
      if (!e.phases || !e.previousPhases) return null;
      return e.phases[PHASE_FIELDS[phase]] - e.previousPhases[PHASE_FIELDS[phase]];
    }),
  }));
  return {
    rows,
    series,
    previousTotals: rows.map(e => (e.previousPhases ? phaseTotal(e.previousPhases) : null)),
  };
}

/**
 * A signed duration change, in the app's duration format: `+38ms`, `-1.24s`,
 * `0ms`. Sign first so a tooltip reads as a direction before it reads as a
 * number.
 */
export function formatDeltaMs(deltaMs: number): string {
  if (deltaMs === 0) return formatMs(0);
  return `${deltaMs > 0 ? '+' : '-'}${formatMs(Math.abs(deltaMs))}`;
}
