/**
 * Headline for a probe step whose response body cannot be shown. Most reasons
 * mean the body was never kept at all; `bodyExpired` and `storeRemoved`
 * describe a body that was stored and has gone since, so those take the second
 * prefix — "Body not stored" would read as a fault where none happened.
 */
import { reindentJson } from '@/utils/jsonReindent';

const NO_LONGER_STORED: readonly string[] = ['bodyExpired', 'storeRemoved'];

/** The i18n key of the prefix that fits `reason`. */
export function bodyNotStoredPrefixKey(reason: string): string {
  return NO_LONGER_STORED.includes(reason) ? 'results.bodyNoLongerStored' : 'results.bodyNotStored';
}

/** What the panel does with a body it has been asked to show. */
export type BodyDisplay = 'format' | 'wrap' | 'binary' | 'too-large';

/** The little the caller knows about a body — some of it only after it arrives. */
export interface BodyShape {
  /**
   * Size in bytes: the step's recorded response size before the body is
   * fetched, the body's own length once it has been. Null when the step never
   * recorded one.
   */
  sizeBytes: number | null;
  /** `base64` when the body is bytes rather than text. Unknown until it arrives. */
  encoding?: 'base64' | null;
  /** The body itself, once it has arrived. */
  text?: string | null;
}

/**
 * Decides how a body is shown — or that it is not shown at all.
 *
 * Callable before the body is fetched, with nothing but the size the step
 * recorded: a `too-large` verdict there means the fetch is not worth making,
 * since the answer would only be thrown away. Called again once the body has
 * arrived, when its real length settles a step that recorded no size or
 * recorded the wrong one.
 *
 * The content type deliberately takes no part. Whether a body can be laid out
 * is decided by whether it parses as JSON — a media type promises that and
 * does not deliver it, and plenty of APIs deliver it without promising it —
 * and whether a body is bytes is settled by `encoding`, which is the server's
 * own verdict rather than a guess from a header. The content type decides the
 * download's file extension, which is the one question it can answer.
 */
export function decideBodyDisplay(shape: BodyShape): BodyDisplay {
  if (shape.sizeBytes != null && shape.sizeBytes > BODY_DISPLAY_MAX_BYTES) return 'too-large';
  if (shape.encoding === 'base64') return 'binary';
  const text = shape.text;
  // Nothing here yet — the size passed, so the fetch is worth making.
  if (text == null) return 'wrap';
  if (utf8ByteLength(text) > BODY_DISPLAY_MAX_BYTES) return 'too-large';
  return isJsonText(text) ? 'format' : 'wrap';
}

/**
 * File extension per media type.
 *
 * Covers every type the body route is willing to report — it answers from a
 * short allow-list rather than echoing whatever the target sent — plus the
 * structured-suffix and `+json`/`+xml` forms, so the map stays right if that
 * list grows.
 */
const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/json': 'json',
  'text/json': 'json',
  'application/x-ndjson': 'ndjson',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/javascript': 'js',
  'text/javascript': 'js',
  'application/ecmascript': 'js',
  'text/css': 'css',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/gzip': 'gz',
};

/**
 * `application/json; charset=utf-8` → `json`.
 *
 * Falls back to `fallback` — `bin` unless the caller knows better — for a type
 * it does not recognise, for `application/octet-stream`, and for no type at
 * all, which is the ordinary case: the route reports a type only for a body
 * whose store recorded one. A wrong extension is worse than a neutral one,
 * since it tells the operating system to open the file with a program that
 * cannot read it, so the caller's fallback should be what it can actually
 * vouch for — `json` for a body it just parsed, `txt` for one that decoded as
 * text, `bin` otherwise.
 */
export function bodyFileExtension(contentType: string | null | undefined, fallback = 'bin'): string {
  if (!contentType) return fallback;
  const media = contentType.split(';')[0].trim().toLowerCase();
  if (media in EXTENSIONS) return EXTENSIONS[media];
  // Structured-suffix types: `application/vnd.api+json`, `image/svg+xml`.
  if (media.endsWith('+json')) return 'json';
  if (media.endsWith('+xml')) return 'xml';
  return fallback;
}

/**
 * The body as the exact bytes the check received, ready to be saved.
 *
 * A base64 body is decoded back to the bytes it stands for — saving the
 * base64 text would save a description of the response rather than the
 * response. A text body is written as UTF-8, which is what `Blob` does with a
 * string and what the body was stored as, so it round-trips byte for byte.
 * Never the laid-out text: the file is the record, and the line breaks this
 * app adds for reading are not part of it.
 */
export function bodyToBlob(
  content: string,
  encoding: 'base64' | null | undefined,
  contentType: string | null | undefined,
): Blob {
  if (encoding === 'base64') {
    const binary = atob(content);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new Blob([bytes], { type: contentType || 'application/octet-stream' });
  }
  return new Blob([content], { type: contentType || 'text/plain;charset=utf-8' });
}

/** Lowercase, alphanumerics and dashes only, collapsed and trimmed. */
function slug(value: string, max: number): string {
  return value.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

/** `2026-09-20T09:15:00Z` → `20260920T091500Z`; anything unparseable → ''. */
function compactInstant(startedAt: string | null | undefined): string {
  if (!startedAt) return '';
  const parsed = Date.parse(startedAt);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

/** What a downloaded body is called. */
export interface BodyFileNameParts {
  serviceName?: string | null;
  /** The run's start instant; the run id stands in for it when it is missing. */
  startedAt?: string | null;
  resultId?: string | null;
  /** 1-based call number within the run. */
  stepNum: number;
  contentType?: string | null;
  /** Extension to use when the content type does not name one. */
  fallbackExtension?: string;
}

/**
 * `checkout-journey-20260920T091500Z-call2.json`.
 *
 * Named after what it is rather than after the id it came from, so a folder of
 * saved bodies still makes sense a week later. Every part is optional except
 * the call number: a missing name falls back to `body`, and a missing start
 * instant to a short run id, so the name stays unique within a run either way.
 */
export function bodyFileName(parts: BodyFileNameParts): string {
  const service = slug(parts.serviceName ?? '', 48) || 'body';
  const when = compactInstant(parts.startedAt) || slug(parts.resultId ?? '', 8);
  const stamp = when ? `-${when}` : '';
  const ext = bodyFileExtension(parts.contentType, parts.fallbackExtension ?? 'bin');
  return `${service}${stamp}-call${parts.stepNum}.${ext}`;
}

/**
 * Largest body, in UTF-8 bytes, this panel puts on screen at all.
 *
 * Past it the body is not rendered — not laid out, and not dumped raw either,
 * because a megabyte of response as one unbroken line is no more readable than
 * no response and costs a great deal more to draw. The panel says how big it is
 * and offers it as a download, which is the form in which something that size
 * is actually useful.
 *
 * ONE number covers both decisions — whether to lay a body out, and whether to
 * show it — because the measurements put both on the same side of the same
 * line. Measured 2026-09-20, in the running app on a desktop Chromium, over
 * generated JSON of the usual shape (arrays of objects, some long string
 * values). "Block" is the longest long-task entry between asking for the body
 * and the frame that painted it; "painted" is the whole wait, network included.
 *
 * | body   | walk  | block  | painted | painted, shown raw |
 * |--------|-------|--------|---------|--------------------|
 * |  64 KB |  4 ms |   none |   65 ms |              65 ms |
 * | 100 KB |  1 ms |   none |   84 ms |                    |
 * | 128 KB |  3 ms |  60 ms |  102 ms |                    |
 * | 160 KB |  2 ms |  57 ms |  101 ms |                    |
 * | 192 KB |  3 ms |  70 ms |  119 ms |                    |
 * | 256 KB |  4 ms |  89 ms |  154 ms |             125 ms |
 * | 500 KB |  7 ms | 219 ms |  333 ms |             219 ms |
 * |   1 MB | 11 ms | 331 ms |  454 ms |             280 ms |
 *
 * The walk is never the cost — 11 ms at a megabyte — so this is not about the
 * re-indenter being slow; it is about the tens of thousands of lines it hands
 * the layout engine. 256 KB reaches 89 ms, which is at the ~100 ms limit
 * rather than under it, and this is a fast machine; halving it is the headroom
 * a slower one needs.
 *
 * A body under this that is NOT JSON is wrapped rather than laid out, so the
 * worst case the limit allows is 128 KB of minified markup — one unbroken line
 * with no whitespace to break on, which is the shape wrapping is hardest on.
 * Measured the same way: 122 KB of single-line HTML blocked for 0-50 ms and
 * painted in 83-85 ms, and the pane then scrolled at 60fps. Comfortably inside
 * the same limit, so wrapping does not need a lower one of its own.
 */
export const BODY_DISPLAY_MAX_BYTES = 128_000;

/** UTF-8 length of `text`, without allocating a copy of it. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++; } // surrogate pair
    else bytes += 3;
  }
  return bytes;
}

/**
 * Whether the text IS JSON — the only test applied before laying one out.
 *
 * A JSON media type does not make a body parseable and is not needed to
 * recognise one, since plenty of APIs send JSON as `text/plain`, so what
 * decides is the text itself. `JSON.parse` is used as the gate and its result
 * thrown away: the layout works on the original characters, never on anything
 * re-serialised from the parse.
 */
export function isJsonText(text: string): boolean {
  // A character is never fewer bytes than it is UTF-16 units, so a string
  // longer than the cap is over it whatever it holds. Worth checking first:
  // that is the case the cap exists for, and it is the one where parsing would
  // cost the most.
  if (text.length > BODY_DISPLAY_MAX_BYTES) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The body as it should be shown: laid out when it is JSON and small enough,
 * and otherwise exactly the string that arrived.
 */
export function layOutJsonBody(text: string | null | undefined): string {
  if (!text) return text ?? '';
  if (text.length > BODY_DISPLAY_MAX_BYTES) return text;
  if (utf8ByteLength(text) > BODY_DISPLAY_MAX_BYTES) return text;
  return isJsonText(text) ? reindentJson(text) : text;
}
