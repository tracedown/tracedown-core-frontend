import { useI18n } from 'vue-i18n';
import { tickSlow } from '@/lib/timeTick';
import { formatDate, formatDateTime } from '@/lib/dateFormat';

/**
 * Relative-time formatters for templates. Each function reads `tickSlow`
 * so any render using it recomputes every 45s without per-component timers.
 * Must be called inside `setup` (uses i18n).
 */
export function useRelativeTime() {
  const { t } = useI18n();

  /** "Just now" / "5m ago" / "3h ago", falling back to the org-format date. */
  function formatAgo(iso: string): string {
    void tickSlow.value;
    const date = new Date(iso);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return t('common.time.justNow');
    if (diffMin < 60) return t('common.time.minutesAgo', { n: diffMin });
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return t('common.time.hoursAgo', { n: diffHours });
    return formatDate(date);
  }

  /** Compact elapsed duration since `iso`: "<1m", "5m", "2h 10m", "3d 4h". */
  function formatDuration(iso: string): string {
    void tickSlow.value;
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return '<1m';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    const remainMin = diffMin % 60;
    if (diffHours < 24) return remainMin > 0 ? `${diffHours}h ${remainMin}m` : `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    const remainHours = diffHours % 24;
    return remainHours > 0 ? `${diffDays}d ${remainHours}h` : `${diffDays}d`;
  }

  /** "Just now" / "Nm ago" within an hour, absolute org-format timestamp after. */
  function formatLastOnline(iso: string): string {
    void tickSlow.value;
    const date = new Date(iso);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return t('common.time.justNow');
    if (diffMin <= 60) return t('common.time.minutesAgo', { n: diffMin });
    return formatDateTime(date);
  }

  return { formatAgo, formatDuration, formatLastOnline };
}
