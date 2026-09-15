import { describe, expect, it } from 'vitest';
import { bodyNotStoredPrefixKey } from '@/utils/resultBodies';

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
