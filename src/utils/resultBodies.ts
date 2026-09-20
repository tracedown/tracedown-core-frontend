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

/**
 * Largest body, in UTF-8 bytes, that is laid out before being shown. Anything
 * larger is shown exactly as it arrived, and nothing is said about it — a
 * response too big to lay out is not a problem the reader has to be told
 * about.
 *
 * Measured 2026-09-20, in the running app on a desktop Chromium, over
 * generated JSON of the usual shape (arrays of objects, some long string
 * values). "Block" is the longest long-task entry between asking for the body
 * and the frame that painted it; "painted" is the whole wait, network
 * included.
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
 * Two things the table settles. The walk is never the cost — 11 ms at a
 * megabyte — so the cap is not about this code being slow; it is about the
 * tens of thousands of lines it hands the layout engine. And scrolling never
 * is either: the pane held 60fps at every size, and in fact scrolled WORSE
 * with the body raw, because one unbroken megabyte-long line is the thing a
 * browser struggles with.
 *
 * So the cap is set by the block alone. 256 KB reaches 89 ms, which is at the
 * limit rather than under it, and this is a fast machine; halving that is the
 * headroom a slower one needs. Beyond it the raw body is the cheaper thing to
 * show anyway.
 */
export const JSON_BODY_LAYOUT_MAX_BYTES = 128_000;

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

const INDENT = '  ';

function isSpace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

/**
 * Lays out JSON source without rewriting a byte of it.
 *
 * It walks the ORIGINAL text and only ever inserts line breaks and indentation
 * between tokens, or drops whitespace that was already between them. Every
 * token — every number, every string, every escape inside a string — is copied
 * across verbatim.
 *
 * That is the whole point. `JSON.stringify(JSON.parse(text))` would be shorter
 * and would be wrong: it rounds an integer past 2^53 to something the server
 * never sent, turns `1.0` into `1` and `1e3` into `1000`, re-escapes strings
 * its own way, and keeps only the last of two duplicate keys. What is on
 * screen here is a record of what the check actually received, so the only
 * safe transformation is one that cannot change a value.
 *
 * Caller-supplied text is assumed to be valid JSON — [layOutJsonBody] parses
 * it first. Given anything else the walk still terminates and still copies
 * every byte, but the layout is meaningless.
 */
export function reindentJson(text: string): string {
  const out: string[] = [];
  const length = text.length;
  let depth = 0;
  let i = 0;

  const lineBreak = () => { out.push('\n', INDENT.repeat(depth)); };

  while (i < length) {
    const char = text[i];

    // Strings are copied whole, escapes included — nothing inside one is
    // whitespace, punctuation or structure as far as this walk is concerned.
    if (char === '"') {
      const start = i++;
      while (i < length) {
        const inner = text[i];
        if (inner === '\\') { i += 2; continue; }
        i++;
        if (inner === '"') break;
      }
      out.push(text.slice(start, i));
      continue;
    }

    if (isSpace(char)) { i++; continue; }

    if (char === '{' || char === '[') {
      const close = char === '{' ? '}' : ']';
      let ahead = i + 1;
      while (ahead < length && isSpace(text[ahead])) ahead++;
      // An empty container stays on one line; opening it would only add a
      // blank one.
      if (text[ahead] === close) {
        out.push(char, close);
        i = ahead + 1;
        continue;
      }
      depth++;
      out.push(char);
      lineBreak();
      i++;
      continue;
    }

    if (char === '}' || char === ']') {
      depth--;
      lineBreak();
      out.push(char);
      i++;
      continue;
    }

    if (char === ',') { out.push(','); lineBreak(); i++; continue; }
    if (char === ':') { out.push(': '); i++; continue; }

    // A run of everything else — a number, `true`, `false`, `null` — in one go.
    const start = i;
    while (i < length) {
      const run = text[i];
      if (run === '"' || run === '{' || run === '}' || run === '[' || run === ']'
        || run === ',' || run === ':' || isSpace(run)) break;
      i++;
    }
    if (i === start) i++; // never stall on a byte the grammar does not allow
    out.push(text.slice(start, i));
  }

  return out.join('');
}

/**
 * The body as it should be shown: laid out when it is JSON and small enough,
 * and otherwise exactly the string that arrived.
 *
 * `JSON.parse` is the only test applied. A JSON media type does not make a
 * body parseable and is not needed to recognise one — plenty of APIs send JSON
 * as `text/plain` — so what decides is whether the text IS JSON, which is the
 * same question in both cases.
 */
export function layOutJsonBody(text: string | null | undefined): string {
  if (!text) return text ?? '';
  // A character is never fewer bytes than it is UTF-16 units, so a string
  // longer than the cap is over it whatever it holds. Worth checking first:
  // that is the case the cap exists for, and it is the one where counting the
  // bytes one at a time would cost the most.
  if (text.length > JSON_BODY_LAYOUT_MAX_BYTES) return text;
  if (utf8ByteLength(text) > JSON_BODY_LAYOUT_MAX_BYTES) return text;
  try {
    JSON.parse(text);
  } catch {
    return text;
  }
  return reindentJson(text);
}
