/**
 * Laying out JSON source without rewriting a byte of it.
 *
 * Split out of `resultBodies` because it is a self-contained piece of text
 * mechanics with nothing to do with probe results: given JSON, it returns the
 * same JSON with line breaks in it.
 */

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
