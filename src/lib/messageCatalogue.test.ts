/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The catalogue is read from disk as TEXT: duplicate keys only exist in the
// text, and the i18n build plugin compiles any import of a file under
// src/locale (even `?raw`) into a message object — which is also why this test
// does not live beside the catalogue. Vitest runs from the package root.
const catalogueText = readFileSync('src/locale/en.json', 'utf8');

const sources = import.meta.glob<string>(['/src/**/*.vue', '/src/**/*.ts', '!/src/**/*.test.ts', '!/src/locale/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Object keys that occur twice in the same object, as dotted paths.
 *
 * `JSON.parse` keeps the last of two equal keys and says nothing, so a group
 * added under a name that already holds a plain string silently disappears —
 * and every message in it renders as its own key. The parsed value cannot show
 * that; only the text can.
 */
function duplicateKeys(text: string): string[] {
  const duplicates: string[] = [];
  const stack: { keys: Set<string>; name: string }[] = [];
  let pendingKey: string | null = null;
  let i = 0;

  const readString = (): string => {
    let out = '';
    i++; // opening quote
    while (text[i] !== '"') {
      if (text[i] === '\\') {
        out += text[i] + text[i + 1];
        i += 2;
      } else {
        out += text[i++];
      }
    }
    i++; // closing quote
    return out;
  };

  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const value = readString();
      let j = i;
      while (/\s/.test(text[j] ?? '')) j++;
      if (text[j] === ':' && stack.length > 0) {
        const top = stack[stack.length - 1];
        const path = [...stack.map((s) => s.name).filter(Boolean), value].join('.');
        if (top.keys.has(value)) duplicates.push(path);
        top.keys.add(value);
        pendingKey = value;
      }
      continue;
    }
    if (ch === '{') {
      stack.push({ keys: new Set(), name: pendingKey ?? '' });
      pendingKey = null;
    } else if (ch === '}') {
      stack.pop();
    } else if (ch === ',' || ch === '[') {
      pendingKey = null;
    }
    i++;
  }
  return duplicates;
}

function resolve(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    messages,
  );
}

describe('message catalogue', () => {
  const text = catalogueText;
  const messages: unknown = JSON.parse(text);

  it('defines no key twice in the same object', () => {
    expect(duplicateKeys(text)).toEqual([]);
  });

  it('holds a message for every literal key the source asks for', () => {
    // `t('a.b')` / `$t("a.b")` with a plain literal only: a key built at run
    // time (template literal, concatenation) cannot be checked here.
    const call = /(?<![\w.])\$?t\(\s*(['"])([A-Za-z][\w-]*(?:\.[\w-]+)+)\1/g;
    const missing = new Set<string>();
    expect(Object.keys(sources).length).toBeGreaterThan(50); // the glob really found the source
    for (const source of Object.values(sources)) {
      for (const match of source.matchAll(call)) {
        if (typeof resolve(messages, match[2]) !== 'string') missing.add(match[2]);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});
