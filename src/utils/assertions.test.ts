import { describe, expect, it } from 'vitest';
import { failedAssertionText, parseAssertions } from '@/utils/assertions';

const words = { expected: 'expected', got: 'got' };

describe('parseAssertions', () => {
  it('keeps a scope assertion with its values as JSON text', () => {
    expect(parseAssertions([
      { method: 'expect', scope: 'status', op: 'eq', outcome: 'failed', expected: [200, 404], actual: 500 },
    ])).toEqual([
      { type: 'scope', method: 'expect', outcome: 'failed', scope: 'status', op: 'eq', expected: '[200,404]', actual: '500' },
    ]);
  });

  it('reads an assert condition as an expression with both operands', () => {
    expect(parseAssertions([
      {
        method: 'assert', kind: 'expect', index: 0, outcome: 'failed',
        expression: 'this.body.error eq "service_inactive"', actualLhs: 'not_found', actualRhs: 'service_inactive',
      },
      { method: 'assert', kind: 'check', index: 1, outcome: 'indeterminate', expression: '$$n gt 1', actualLhs: null, actualRhs: 1 },
    ])).toEqual([
      {
        type: 'condition', kind: 'expect', outcome: 'failed',
        expression: 'this.body.error eq "service_inactive"', actualLhs: '"not_found"', actualRhs: '"service_inactive"',
      },
      { type: 'condition', kind: 'check', outcome: 'indeterminate', expression: '$$n gt 1', actualLhs: 'null', actualRhs: '1' },
    ]);
  });

  it('drops entries that are not objects and tolerates a non-array', () => {
    expect(parseAssertions(['x', null, 3])).toEqual([]);
    expect(parseAssertions(null)).toEqual([]);
  });
});

describe('failedAssertionText', () => {
  it('words a scope assertion', () => {
    expect(failedAssertionText({ scope: 'status', expected: '409', actual: '404' }, words))
      .toBe('status: expected 409, got 404');
  });

  it('words a condition by its expression', () => {
    expect(failedAssertionText(
      { scope: 'assert', expected: null, actual: 'not_found', expression: 'this.body.error eq "service_inactive"' },
      words,
    )).toBe('this.body.error eq "service_inactive": got not_found');
  });

  it('marks a missing actual value', () => {
    expect(failedAssertionText({ scope: 'body', expected: null, actual: null }, words)).toBe('body: got ?');
  });
});
