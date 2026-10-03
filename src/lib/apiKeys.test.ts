import { describe, expect, it } from 'vitest';
import {
  actionToastKey, auditKeyChoices, canSubmitMint, expiryDays, groupStarts, mintErrorField, mintFailure,
  mintOutcomeUnknown, mustStay, pageAfterRemoval, passwordBlank, publicApiUrls, showsStateHint,
  stateHintKey, stateLabelKey, userLabel,
} from '@/lib/apiKeys';

describe('mint dialog error mapping', () => {
  it('puts a refused password under the password field', () => {
    expect(mintErrorField('incorrect_password')).toBe('password');
  });

  it('puts a refused second-factor code under the code field', () => {
    expect(mintErrorField('invalid_totp_code')).toBe('code');
  });

  it('reports the key limit and a rejected body for the request as a whole', () => {
    expect(mintErrorField('api_key_limit_reached')).toBe('form');
    expect(mintErrorField('invalid_request_body')).toBe('form');
  });

  it('reports anything else, or no code at all, for the request as a whole', () => {
    expect(mintErrorField('rate_limited')).toBe('form');
    expect(mintErrorField(undefined)).toBe('form');
  });
});

describe('mint failure', () => {
  it('puts a password refusal under the password field only', () => {
    expect(mintFailure('incorrect_password', 'Wrong.', true)).toEqual({
      errors: { password: 'Wrong.', code: '', form: '' }, codeAsked: false, refetch: false,
    });
  });

  it('keeps a code refusal under the code field when the field was already shown', () => {
    expect(mintFailure('invalid_totp_code', 'Bad code.', true)).toEqual({
      errors: { password: '', code: 'Bad code.', form: '' }, codeAsked: false, refetch: false,
    });
  });

  it('reveals the code field and repeats the message at the form when it was not shown', () => {
    expect(mintFailure('invalid_totp_code', 'Code needed.', false)).toEqual({
      errors: { password: '', code: 'Code needed.', form: 'Code needed.' }, codeAsked: true, refetch: false,
    });
  });

  it('asks for a refetch when the outcome is unknown', () => {
    expect(mintFailure('internet_down', 'Offline.', false).refetch).toBe(true);
    expect(mintFailure('api_key_limit_reached', 'Limit.', false)).toEqual({
      errors: { password: '', code: '', form: 'Limit.' }, codeAsked: false, refetch: false,
    });
  });
});

describe('mint form', () => {
  const valid = { name: 'ci', expiresInDays: undefined, password: 'pw', code: '', showCode: false };

  it('submits a complete form', () => {
    expect(canSubmitMint(valid)).toBe(true);
  });

  it('needs a name, a valid expiry and a password', () => {
    expect(canSubmitMint({ ...valid, name: '  ' })).toBe(false);
    expect(canSubmitMint({ ...valid, expiresInDays: null })).toBe(false);
    expect(canSubmitMint({ ...valid, password: '' })).toBe(false);
  });

  it('refuses a password that is only whitespace, but accepts one with spaces in it', () => {
    expect(passwordBlank('   ')).toBe(true);
    expect(canSubmitMint({ ...valid, password: '   ' })).toBe(false);
    expect(canSubmitMint({ ...valid, password: ' pw ' })).toBe(true);
  });

  it('needs a code only while the code field is shown', () => {
    expect(canSubmitMint({ ...valid, showCode: true })).toBe(false);
    expect(canSubmitMint({ ...valid, showCode: true, code: '123456' })).toBe(true);
  });

  it('holds the dialog during a mint and on an unacknowledged key', () => {
    expect(mustStay(true, false, false)).toBe(true);
    expect(mustStay(false, true, false)).toBe(true);
    expect(mustStay(false, true, true)).toBe(false);
    expect(mustStay(false, false, false)).toBe(false);
  });
});

describe('mint dialog expiry', () => {
  it('sends nothing for a key that never expires', () => {
    expect(expiryDays('never', '')).toBeUndefined();
  });

  it('sends the preset day counts as numbers', () => {
    expect(expiryDays('30', '')).toBe(30);
    expect(expiryDays('90', '')).toBe(90);
    expect(expiryDays('365', '')).toBe(365);
  });

  it('accepts a custom count inside the range the API takes', () => {
    expect(expiryDays('custom', '1')).toBe(1);
    expect(expiryDays('custom', ' 3650 ')).toBe(3650);
  });

  it('refuses a custom count the API would reject', () => {
    expect(expiryDays('custom', '')).toBeNull();
    expect(expiryDays('custom', '0')).toBeNull();
    expect(expiryDays('custom', '3651')).toBeNull();
    expect(expiryDays('custom', '1.5')).toBeNull();
    expect(expiryDays('custom', '-3')).toBeNull();
  });
});

describe('mint outcome', () => {
  it('treats a transport failure as an unknown outcome', () => {
    expect(mintOutcomeUnknown('internet_down')).toBe(true);
    expect(mintOutcomeUnknown('unknown_error')).toBe(true);
  });

  it('treats every refusal the server answered as known', () => {
    for (const code of ['incorrect_password', 'invalid_totp_code', 'api_key_limit_reached', 'invalid_request_body', 'rate_limited']) {
      expect(mintOutcomeUnknown(code)).toBe(false);
    }
    expect(mintOutcomeUnknown(undefined)).toBe(false);
  });
});

describe('public API location', () => {
  const origin = 'https://dash.example.com';

  it('sits beside a same-origin dashboard API', () => {
    expect(publicApiUrls('/api/v1', origin)).toEqual({
      baseUrl: 'https://dash.example.com/api/public/v1',
      descriptionUrl: 'https://dash.example.com/api/openapi/public/v1.json',
    });
  });

  it('defaults to the same origin when no API URL is configured', () => {
    expect(publicApiUrls(undefined, origin).baseUrl).toBe('https://dash.example.com/api/public/v1');
  });

  it('follows an API on another host and under a path prefix', () => {
    expect(publicApiUrls('https://api.example.com/td/api/v1/', origin)).toEqual({
      baseUrl: 'https://api.example.com/td/api/public/v1',
      descriptionUrl: 'https://api.example.com/td/api/openapi/public/v1.json',
    });
  });

  it('handles a base configured as the bare /api', () => {
    expect(publicApiUrls('https://api.example.com/api', origin)).toEqual({
      baseUrl: 'https://api.example.com/api/public/v1',
      descriptionUrl: 'https://api.example.com/api/openapi/public/v1.json',
    });
  });
});

describe('page after a removal', () => {
  it('stays on a page that still has rows', () => {
    expect(pageAfterRemoval(2, 51, 50)).toBe(2);
  });

  it('stays on an earlier page that still exists', () => {
    expect(pageAfterRemoval(1, 120, 50)).toBe(1);
  });

  it('steps back when the page emptied', () => {
    expect(pageAfterRemoval(2, 50, 50)).toBe(1);
    expect(pageAfterRemoval(3, 10, 50)).toBe(1);
  });

  it('never goes below page one', () => {
    expect(pageAfterRemoval(1, 0, 50)).toBe(1);
  });
});

describe('state badge and explanation', () => {
  it('labels and explains an orphaned key as dead, in the shapes the API sends', () => {
    for (const state of ['inactive', 'revoked'] as const) {
      const key = { state, createdBy: null };
      expect(stateLabelKey(key)).toBe('apiKeys.states.orphaned');
      expect(stateHintKey(key, 'oversight')).toBe('apiKeys.stateHints.orphaned');
      expect(stateHintKey(key, 'own')).toBe('apiKeys.stateHints.orphaned');
      expect(showsStateHint(key)).toBe(true);
    }
  });

  it('tells a reader who cannot delete an orphaned key nothing about deleting it', () => {
    expect(stateHintKey({ state: 'inactive', createdBy: null }, 'oversight', false))
      .toBe('apiKeys.stateHints.orphanedReadOnly');
  });

  it('words an inactive key for the reader', () => {
    expect(stateHintKey({ state: 'inactive', createdBy: 'u1' }, 'own')).toBe('apiKeys.stateHints.inactiveOwn');
    expect(stateHintKey({ state: 'inactive', createdBy: 'u1' }, 'oversight')).toBe('apiKeys.stateHints.inactive');
  });

  it('warns about two-factor on an active key in your own list only', () => {
    expect(stateHintKey({ state: 'active', createdBy: 'u1' }, 'own')).toBe('apiKeys.stateHints.activeOwn');
    expect(stateHintKey({ state: 'active', createdBy: 'u1' }, 'oversight')).toBe('apiKeys.stateHints.active');
  });

  it('uses the state’s own label and explanation otherwise', () => {
    expect(stateLabelKey({ state: 'revoked', createdBy: 'u1' })).toBe('apiKeys.states.revoked');
    expect(stateHintKey({ state: 'revoked', createdBy: 'u1' }, 'oversight')).toBe('apiKeys.stateHints.revoked');
  });

  it('writes the explanation out for every state but active', () => {
    expect(showsStateHint({ state: 'active', createdBy: 'u1' })).toBe(false);
    expect(showsStateHint({ state: 'expired', createdBy: 'u1' })).toBe(true);
    expect(showsStateHint({ state: 'inactive', createdBy: 'u1' })).toBe(true);
  });
});

describe('list helpers', () => {
  it('marks the first row of each holder’s run', () => {
    const keys = [
      { id: 'a', createdBy: 'u1' }, { id: 'b', createdBy: 'u1' },
      { id: 'c', createdBy: 'u2' }, { id: 'd', createdBy: null }, { id: 'e', createdBy: null },
    ];
    expect([...groupStarts(keys)]).toEqual(['a', 'c', 'd']);
    expect(groupStarts([]).size).toBe(0);
  });

  it('names the holder by erased label, then name, then email, then id', () => {
    const base = { createdBy: 'u1', createdByName: 'Ada', createdByEmail: 'ada@example.com' };
    expect(userLabel({ ...base, createdBy: null }, 'Deleted account')).toBe('Deleted account');
    expect(userLabel(base, 'x')).toBe('Ada');
    expect(userLabel({ ...base, createdByName: null }, 'x')).toBe('ada@example.com');
    expect(userLabel({ createdBy: 'u1', createdByName: '', createdByEmail: null }, 'x')).toBe('u1');
  });

  it('chooses the toast for an action that went through or found the key gone', () => {
    expect(actionToastKey('revoke', undefined)).toBe('apiKeys.revokedToast');
    expect(actionToastKey('delete', false)).toBe('apiKeys.deletedToast');
    expect(actionToastKey('revoke', true)).toBe('apiKeys.goneToast');
    expect(actionToastKey('delete', true)).toBe('apiKeys.goneToast');
  });
});

describe('audit key choices', () => {
  const keys = [{ id: 'k1', name: 'ci', prefix: 'td_abcdefgh' }];

  it('offers the organization’s keys, then deleted keys the entries named, once each', () => {
    const seen = new Map<string, string | null>([['k1', 'ci'], ['gone', 'old-deploy']]);
    expect(auditKeyChoices(keys, seen, null)).toEqual([
      { id: 'k1', name: 'ci', prefix: 'td_abcdefgh' },
      { id: 'gone', name: 'old-deploy', prefix: null },
    ]);
  });

  it('keeps a key asked for by id even when nothing else knows it', () => {
    expect(auditKeyChoices(keys, new Map(), 'k9')).toEqual([
      { id: 'k1', name: 'ci', prefix: 'td_abcdefgh' },
      { id: 'k9', name: null, prefix: null },
    ]);
  });
});
