import { describe, expect, it } from 'vitest';
import { formatMs } from '@/lib/metrics-utils';

describe('formatMs', () => {
  it('stays in milliseconds under a second, rounded', () => {
    expect(formatMs(0)).toBe('0ms');
    expect(formatMs(82)).toBe('82ms');
    expect(formatMs(840.4)).toBe('840ms');
    expect(formatMs(999.4)).toBe('999ms');
  });

  it('switches to seconds with two decimals at a second', () => {
    expect(formatMs(1000)).toBe('1.00s');
    expect(formatMs(1120)).toBe('1.12s');
    expect(formatMs(1240)).toBe('1.24s');
    expect(formatMs(65000)).toBe('65.00s');
  });
});
