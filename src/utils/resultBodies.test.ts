import { describe, expect, it } from 'vitest';
import {
  BODY_DISPLAY_MAX_BYTES,
  bodyFileExtension,
  bodyFileName,
  bodyNotStoredPrefixKey,
  bodyToBlob,
  decideBodyDisplay,
  layOutJsonBody,
  utf8ByteLength,
} from '@/utils/resultBodies';
import { reindentJson } from '@/utils/jsonReindent';

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
    const source = generateJson(BODY_DISPLAY_MAX_BYTES - 4_000);
    expect(utf8ByteLength(source)).toBeLessThan(BODY_DISPLAY_MAX_BYTES);
    const laid = layOutJsonBody(source);
    expect(laid).not.toBe(source);
    expect(tokenSignature(laid)).toBe(tokenSignature(source));
  });

  it('leaves a body just over the cap exactly as it arrived, silently', () => {
    const source = generateJson(BODY_DISPLAY_MAX_BYTES + 4_000);
    expect(utf8ByteLength(source)).toBeGreaterThan(BODY_DISPLAY_MAX_BYTES);
    expect(layOutJsonBody(source)).toBe(source);
  });

  it('turns away a body longer than the cap without counting its bytes', () => {
    const source = generateJson(BODY_DISPLAY_MAX_BYTES * 8);
    expect(source.length).toBeGreaterThan(BODY_DISPLAY_MAX_BYTES);
    expect(layOutJsonBody(source)).toBe(source);
  });

  it('counts the cap in bytes, not characters', () => {
    // Each 😀 is four UTF-8 bytes but only two UTF-16 units, so this string is
    // half the cap long in characters and just over the cap in bytes.
    const wide = `"${'😀'.repeat(BODY_DISPLAY_MAX_BYTES / 4)}"`;
    expect(wide.length).toBeLessThan(BODY_DISPLAY_MAX_BYTES);
    expect(layOutJsonBody(wide)).toBe(wide);
  });
});

describe('bodyFileExtension', () => {
  it('maps the media types the body route can report', () => {
    const cases: Record<string, string> = {
      'application/json': 'json',
      'text/json': 'json',
      'application/x-ndjson': 'ndjson',
      'text/html': 'html',
      'application/xml': 'xml',
      'text/xml': 'xml',
      'text/plain': 'txt',
      'text/markdown': 'md',
      'text/csv': 'csv',
      'application/javascript': 'js',
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
    for (const [type, ext] of Object.entries(cases)) {
      expect(bodyFileExtension(type)).toBe(ext);
    }
  });

  it('ignores parameters, case and surrounding space', () => {
    expect(bodyFileExtension('application/json; charset=utf-8')).toBe('json');
    expect(bodyFileExtension('  APPLICATION/JSON  ')).toBe('json');
    expect(bodyFileExtension('text/HTML;charset=ISO-8859-1')).toBe('html');
  });

  it('understands structured suffixes', () => {
    expect(bodyFileExtension('application/vnd.api+json')).toBe('json');
    expect(bodyFileExtension('application/atom+xml')).toBe('xml');
  });

  it('falls back rather than guessing an extension it cannot justify', () => {
    expect(bodyFileExtension(null)).toBe('bin');
    expect(bodyFileExtension(undefined)).toBe('bin');
    expect(bodyFileExtension('')).toBe('bin');
    expect(bodyFileExtension('application/octet-stream')).toBe('bin');
    expect(bodyFileExtension('application/x-made-up')).toBe('bin');
    // The caller knows the body decoded as text even when no type came back.
    expect(bodyFileExtension(null, 'txt')).toBe('txt');
    expect(bodyFileExtension('application/octet-stream', 'json')).toBe('json');
  });
});

describe('bodyFileName', () => {
  const base = { startedAt: '2026-09-20T09:15:00Z', stepNum: 2 };

  it('names a body after its service, its run and its call', () => {
    expect(bodyFileName({ ...base, serviceName: 'checkout-journey', contentType: 'application/json' }))
      .toBe('checkout-journey-20260920T091500Z-call2.json');
  });

  it('sanitises a service name into something a filesystem accepts', () => {
    expect(bodyFileName({ ...base, serviceName: 'Check out / Journey #3!' }))
      .toBe('check-out-journey-3-20260920T091500Z-call2.bin');
    expect(bodyFileName({ ...base, serviceName: '  ../../etc/passwd  ' }))
      .toBe('etc-passwd-20260920T091500Z-call2.bin');
    expect(bodyFileName({ ...base, serviceName: '***' }))
      .toBe('body-20260920T091500Z-call2.bin');
  });

  it('caps a very long service name', () => {
    const name = bodyFileName({ ...base, serviceName: 'a'.repeat(200) });
    expect(name.startsWith('a'.repeat(48))).toBe(true);
    expect(name.startsWith('a'.repeat(49))).toBe(false);
  });

  it('drops sub-second precision and punctuation from the instant', () => {
    expect(bodyFileName({ startedAt: '2026-09-20T09:15:00.123456Z', stepNum: 1, serviceName: 'svc' }))
      .toBe('svc-20260920T091500Z-call1.bin');
  });

  it('stands a short run id in for a missing or unusable instant', () => {
    expect(bodyFileName({ stepNum: 1, serviceName: 'svc', resultId: 'ac3e0200-0000-4000-8000-000000000200' }))
      .toBe('svc-ac3e0200-call1.bin');
    expect(bodyFileName({ startedAt: 'not a date', stepNum: 1, serviceName: 'svc', resultId: 'ac3e0200-xyz' }))
      .toBe('svc-ac3e0200-call1.bin');
  });

  it('still produces a usable name with nothing but a call number', () => {
    expect(bodyFileName({ stepNum: 3 })).toBe('body-call3.bin');
  });
});

describe('decideBodyDisplay', () => {
  it('refuses a body the step already records as oversized, before any fetch', () => {
    expect(decideBodyDisplay({ sizeBytes: BODY_DISPLAY_MAX_BYTES + 1 })).toBe('too-large');
    // Even when the content would otherwise have been laid out.
    expect(decideBodyDisplay({ sizeBytes: 5_000_000, text: '{"a":1}' })).toBe('too-large');
  });

  it('lets a body through on the recorded size alone, so it can be fetched', () => {
    expect(decideBodyDisplay({ sizeBytes: 2_000 })).toBe('wrap');
    expect(decideBodyDisplay({ sizeBytes: null })).toBe('wrap');
  });

  it('calls bytes bytes', () => {
    expect(decideBodyDisplay({ sizeBytes: 500, encoding: 'base64', text: 'AAEC' })).toBe('binary');
  });

  it('lays out JSON and wraps everything else', () => {
    expect(decideBodyDisplay({ sizeBytes: 7, text: '{"a":1}' })).toBe('format');
    expect(decideBodyDisplay({ sizeBytes: 20, text: '<html><body>hi</body></html>' })).toBe('wrap');
    expect(decideBodyDisplay({ sizeBytes: 11, text: 'hello world' })).toBe('wrap');
  });

  it('catches a body bigger than the step claimed', () => {
    const big = `"${'x'.repeat(BODY_DISPLAY_MAX_BYTES + 10)}"`;
    expect(decideBodyDisplay({ sizeBytes: 100, text: big })).toBe('too-large');
  });

  it('measures the fallback in bytes, not characters', () => {
    const wide = `"${'😀'.repeat(BODY_DISPLAY_MAX_BYTES / 4)}"`;
    expect(decideBodyDisplay({ sizeBytes: null, text: wide })).toBe('too-large');
  });
});

describe('bodyToBlob', () => {
  const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

  it('writes a text body as UTF-8, non-ASCII included', async () => {
    const text = '{"name":"café 日本語 😀","sign":"±"}';
    const blob = bodyToBlob(text, null, 'application/json');
    expect(await bytesOf(blob)).toEqual(new TextEncoder().encode(text));
  });

  it('decodes a base64 body back to the bytes it stands for', async () => {
    const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x7f]);
    const base64 = btoa(String.fromCharCode(...original));
    const blob = bodyToBlob(base64, 'base64', 'image/png');
    expect(await bytesOf(blob)).toEqual(original);
    expect(blob.type).toBe('image/png');
  });

  it('saves the text as it arrived, never the laid-out copy', async () => {
    const text = '{"a":1,"b":2}';
    expect(await bytesOf(bodyToBlob(text, null, null)))
      .toEqual(new TextEncoder().encode(text));
    expect(layOutJsonBody(text)).not.toBe(text);
  });

  it('falls back to a neutral media type', () => {
    expect(bodyToBlob('x', null, null).type).toBe('text/plain;charset=utf-8');
    expect(bodyToBlob('eA==', 'base64', null).type).toBe('application/octet-stream');
  });
});
