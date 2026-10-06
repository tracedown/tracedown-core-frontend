import type { ParsedAssertion } from '@/data/results/ResultDto';
import type { FailedAssertion } from '@/data/services/ServiceDto';

/** A recorded value as display text; an absent one is empty. */
function valueText(value: unknown): string {
  if (value === undefined) return '';
  return JSON.stringify(value) ?? String(value);
}

/**
 * Normalizes the raw `assertionResults` JSON of a probe step. Both record
 * shapes of spec §9.2 are kept: an `assert` condition has no scope, op or
 * expected value, only its expression and operands. Entries that are not
 * objects are dropped.
 */
export function parseAssertions(raw: unknown): ParsedAssertion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => a != null && typeof a === 'object')
    .map((a): ParsedAssertion => {
      const outcome = String(a.outcome ?? '');
      if (a.method === 'assert') {
        return {
          type: 'condition',
          kind: String(a.kind ?? ''),
          outcome,
          expression: String(a.expression ?? ''),
          actualLhs: valueText(a.actualLhs),
          actualRhs: valueText(a.actualRhs),
        };
      }
      return {
        type: 'scope',
        method: String(a.method ?? ''),
        outcome,
        scope: String(a.scope ?? ''),
        op: String(a.op ?? ''),
        expected: valueText(a.expected),
        actual: valueText(a.actual),
      };
    });
}

/**
 * One failed assertion of a service's last run, in a line:
 * `status: expected 409, got 404`, or for a condition
 * `this.body.error eq "service_inactive": got not_found`.
 */
export function failedAssertionText(
  a: FailedAssertion,
  words: { expected: string; got: string },
): string {
  const got = `${words.got} ${a.actual ?? '?'}`;
  if (a.expression) return `${a.expression}: ${got}`;
  const expected = a.expected ? `${words.expected} ${a.expected}, ` : '';
  return `${a.scope}: ${expected}${got}`;
}
