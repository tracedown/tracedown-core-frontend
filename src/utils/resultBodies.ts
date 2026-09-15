/**
 * Headline for a probe step whose response body cannot be shown. Most reasons
 * mean the body was never kept at all; `bodyExpired` and `storeRemoved`
 * describe a body that was stored and has gone since, so those take the second
 * prefix — "Body not stored" would read as a fault where none happened.
 */
const NO_LONGER_STORED: readonly string[] = ['bodyExpired', 'storeRemoved'];

/** The i18n key of the prefix that fits `reason`. */
export function bodyNotStoredPrefixKey(reason: string): string {
  return NO_LONGER_STORED.includes(reason) ? 'results.bodyNoLongerStored' : 'results.bodyNotStored';
}
