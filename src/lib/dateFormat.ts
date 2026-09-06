import { ref } from 'vue';
import type { SelectOption } from '@/types/ui/common';

/**
 * Org-wide date format. `eu` renders dd.mm.yyyy, `us` renders mm/dd/yyyy;
 * the time part is always 24-hour. The org setting arrives with the session
 * (`MeResponse.orgDateFormat`) and again whenever the org settings are
 * (re)loaded, so every member sees the same dates regardless of browser
 * locale. Formatters below read the ref, so templates and computeds
 * re-render when it changes.
 */
export type DateFormat = 'eu' | 'us';

export const DATE_FORMATS: readonly DateFormat[] = ['eu', 'us'];

export const dateFormat = ref<DateFormat>('eu');

/** Adopts a server-side value; anything unknown falls back to `eu`. */
export function setDateFormat(value: string | null | undefined): void {
  dateFormat.value = value === 'us' ? 'us' : 'eu';
}

export function dateFormatOptions(t: (key: string) => string): SelectOption[] {
  return DATE_FORMATS.map(value => ({ value, label: t(`settings.dateFormats.${value}`) }));
}

type DateInput = Date | string | number;

function toDate(input: DateInput): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** What an unparseable input renders as: the raw string, or nothing. */
function raw(input: DateInput): string {
  return typeof input === 'string' ? input : '';
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `06.09.2026` / `09/06/2026`, in the viewer's local timezone. */
export function formatDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return raw(input);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  return dateFormat.value === 'us'
    ? `${month}/${day}/${d.getFullYear()}`
    : `${day}.${month}.${d.getFullYear()}`;
}

/** Year-less `06.09.` / `09/06`, for chart axes and dense lists. */
export function formatShortDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return raw(input);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  return dateFormat.value === 'us' ? `${month}/${day}` : `${day}.${month}.`;
}

/** `14:05`, or `14:05:07` with `seconds`. Always 24-hour. */
export function formatTime(input: DateInput, opts: { seconds?: boolean } = {}): string {
  const d = toDate(input);
  if (!d) return raw(input);
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return opts.seconds ? `${base}:${pad(d.getSeconds())}` : base;
}

/** `06.09.2026 14:05` / `09/06/2026 14:05`. */
export function formatDateTime(input: DateInput, opts: { seconds?: boolean } = {}): string {
  const d = toDate(input);
  if (!d) return raw(input);
  return `${formatDate(d)} ${formatTime(d, opts)}`;
}

/** `06.09. 14:05` / `09/06 14:05` — the compact form for logs and charts. */
export function formatShortDateTime(input: DateInput, opts: { seconds?: boolean } = {}): string {
  const d = toDate(input);
  if (!d) return raw(input);
  return `${formatShortDate(d)} ${formatTime(d, opts)}`;
}
