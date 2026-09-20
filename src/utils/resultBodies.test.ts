import { describe, expect, it } from 'vitest';
import {
  JSON_BODY_LAYOUT_MAX_BYTES,
  bodyNotStoredPrefixKey,
  layOutJsonBody,
  reindentJson,
  utf8ByteLength,
} from '@/utils/resultBodies';

describe('bodyNotStoredPrefixKey', () => {
  it('says a stored body has gone for bodyExpired and storeRemoved', () => {
    expect(bodyNotStoredPrefixKey('bodyExpired')).toBe('results.bodyNoLongerStored');
    expect(bodyNotStoredPrefixKey('storeRemoved')).toBe('results.bodyNoLongerStored');
  });

  it('keeps the plain prefix for every other reason', () => {
    for (const reason of ['notRequested', 'unverifiedTarget', 'bodyTooLarge', 'timeout',
      'storageUnavailable', 'outsideAssignedStore', 'storeOrgMismatch', 'unknownCode']) {
      expect(bodyNotStoredPrefixKey(reason)).toBe('results.bodyNotStored');
    }
  });
});

/**
 * Every token of the input, in order, with the whitespace between tokens gone.
 * Two texts with the same signature differ only in whitespace that JSON does
 * not care about — which is the one change the layout is allowed to make.
 */
function tokenSignature(text: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '"') {
      const start = i++;
      while (i < text.length) {
        const inner = text[i];
        if (inner === '\\') { i += 2; continue; }
        i++;
        if (inner === '"') break;
      }
      out.push(text.slice(start, i));
      continue;
    }
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') { i++; continue; }
    out.push(char);
    i++;
  }
  return out.join('');
}

/** JSON of the shape an API actually returns, sized to about `bytes`. */
function generateJson(bytes: number): string {
  const rows: string[] = [];
  let size = 0;
  for (let i = 0; size < bytes; i++) {
    const row = JSON.stringify({
      id: `ord_${i.toString(36).padStart(8, '0')}`,
      total: 1234.5,
      note: 'a longer free-text field of the sort that shows up in real payloads '.repeat(3),
      tags: ['paid', 'shipped'],
      meta: { retries: 0, ok: true, parent: null },
    });
    rows.push(row);
    size += row.length + 1;
  }
  return `{"items":[${rows.join(',')}],"total":${rows.length}}`;
}

const CORPUS: Record<string, string> = {
  'empty object': '{}',
  'empty array': '[]',
  'empty containers nested': '{"a":{},"b":[],"c":[{},[]]}',
  'flat object': '{"a":1,"b":"two","c":true,"d":null}',
  'deeply nested': '{"a":{"b":{"c":{"d":[1,[2,[3,[4]]]]}}}}',
  'big integer past 2^53': '{"id":12345678901234567890}',
  'negative big integer': '[-99999999999999999999]',
  'trailing zero decimal': '{"a":1.0,"b":2.50,"c":-0.0}',
  'exponent forms': '{"a":1e3,"b":1E+3,"c":1.5e-7,"d":-2E10}',
  'unicode escapes': '{"k":"\\u00e9\\u0041\\uD83D\\uDE00"}',
  'literal unicode': '{"k":"héllo → 日本語 😀"}',
  'escaped quotes and backslashes': '{"k":"she said \\"hi\\" and \\\\ then \\\\\\" left"}',
  'string full of punctuation': '{"k":"{not:[a,structure]}: really, \\"no\\""}',
  'string that looks like whitespace': '{"k":"a\\n  b\\tc"}',
  'duplicate keys': '{"a":1,"a":2,"a":3}',
  'top-level string': '"just a string"',
  'top-level number': '42',
  'top-level true': 'true',
  'top-level null': 'null',
  'already indented': '{\n  "a": [\n    1,\n    2\n  ]\n}',
  'leading and trailing whitespace': '  \n\t{"a":1}\n  ',
  'array of objects': '[{"a":1},{"a":2},{"a":3}]',
  'empty string value': '{"":""}',
};

describe('reindentJson', () => {
  it.each(Object.entries(CORPUS))('keeps every token of %s', (_name, source) => {
    expect(tokenSignature(reindentJson(source))).toBe(tokenSignature(source));
  });

  it.each(Object.entries(CORPUS))('still parses to the same value for %s', (_name, source) => {
    expect(JSON.parse(reindentJson(source))).toEqual(JSON.parse(source));
  });

  it('keeps empty containers on one line', () => {
    expect(reindentJson('{"a":{},"b":[ ]}')).toBe('{\n  "a": {},\n  "b": []\n}');
  });

  it('indents two spaces per level', () => {
    expect(reindentJson('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
  });

  it('leaves a big integer exactly as it arrived, where JSON.stringify would not', () => {
    const source = '{"id":12345678901234567890}';
    expect(reindentJson(source)).toContain('12345678901234567890');
    expect(JSON.stringify(JSON.parse(source))).not.toContain('12345678901234567890');
  });

  it('keeps both of two duplicate keys, which a reparse would drop', () => {
    expect(reindentJson('{"a":1,"a":2}')).toBe('{\n  "a": 1,\n  "a": 2\n}');
  });

  it('copies a string containing braces and commas byte for byte', () => {
    expect(reindentJson('["{\\"a\\": [1, 2]}"]')).toBe('[\n  "{\\"a\\": [1, 2]}"\n]');
  });
});

describe('utf8ByteLength', () => {
  it('agrees with the encoder', () => {
    for (const text of ['', 'ascii', 'héllo', '日本語', '😀😀', 'mixed é 日 😀 x']) {
      expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).length);
    }
  });
});

describe('layOutJsonBody', () => {
  it('lays out a JSON body', () => {
    expect(layOutJsonBody('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('lays out JSON that arrived as plain text — the media type is not the test', () => {
    expect(layOutJsonBody('[1,2]')).toBe('[\n  1,\n  2\n]');
  });

  it('leaves anything that is not JSON alone', () => {
    for (const text of ['hello world', '<html></html>', '{"a":1,}', 'a: 1\nb: 2', '{"a"']) {
      expect(layOutJsonBody(text)).toBe(text);
    }
  });

  it('leaves a body with a byte order mark alone — it is not JSON', () => {
    const source = '﻿{"a":1}';
    expect(layOutJsonBody(source)).toBe(source);
  });

  it('passes an empty or missing body straight through', () => {
    expect(layOutJsonBody('')).toBe('');
    expect(layOutJsonBody(null)).toBe('');
    expect(layOutJsonBody(undefined)).toBe('');
  });

  it('lays out a body just under the cap', () => {
    const source = generateJson(JSON_BODY_LAYOUT_MAX_BYTES - 4_000);
    expect(utf8ByteLength(source)).toBeLessThan(JSON_BODY_LAYOUT_MAX_BYTES);
    const laid = layOutJsonBody(source);
    expect(laid).not.toBe(source);
    expect(tokenSignature(laid)).toBe(tokenSignature(source));
  });

  it('leaves a body just over the cap exactly as it arrived, silently', () => {
    const source = generateJson(JSON_BODY_LAYOUT_MAX_BYTES + 4_000);
    expect(utf8ByteLength(source)).toBeGreaterThan(JSON_BODY_LAYOUT_MAX_BYTES);
    expect(layOutJsonBody(source)).toBe(source);
  });

  it('turns away a body longer than the cap without counting its bytes', () => {
    const source = generateJson(JSON_BODY_LAYOUT_MAX_BYTES * 8);
    expect(source.length).toBeGreaterThan(JSON_BODY_LAYOUT_MAX_BYTES);
    expect(layOutJsonBody(source)).toBe(source);
  });

  it('counts the cap in bytes, not characters', () => {
    // Each 😀 is four UTF-8 bytes but only two UTF-16 units, so this string is
    // half the cap long in characters and just over the cap in bytes.
    const wide = `"${'😀'.repeat(JSON_BODY_LAYOUT_MAX_BYTES / 4)}"`;
    expect(wide.length).toBeLessThan(JSON_BODY_LAYOUT_MAX_BYTES);
    expect(layOutJsonBody(wide)).toBe(wide);
  });
});
