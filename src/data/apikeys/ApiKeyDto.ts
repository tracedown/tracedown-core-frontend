/** The ceiling a key is issued at: `read` keys can only make reads. */
export type ApiKeyAccess = 'read' | 'write';

export const API_KEY_ACCESS_LEVELS: readonly ApiKeyAccess[] = ['read', 'write'];

/**
 * Where a key stands. `inactive`: the user it acts as cannot currently act in
 * the organization, so the key is refused until they can again.
 */
export type ApiKeyState = 'active' | 'revoked' | 'expired' | 'inactive';

/**
 * One API key, as both the user's own list (`/me/api-keys`) and the
 * organization's oversight list (`/api-keys`) return it. `key` is the key
 * itself and is present only in the response that mints it.
 */
export interface ApiKeySummary {
  id: string;
  name: string;
  key?: string | null;
  /** Leading characters of the key, for telling keys apart. Null on keys older than prefixes. */
  prefix: string | null;
  access: ApiKeyAccess;
  state: ApiKeyState;
  organizationId: string;
  organizationName: string;
  /** The user the key acts as. Null once that account has been erased. */
  createdBy: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

/**
 * Request of POST /me/api-keys. Minting asks for the password again, and a
 * TOTP or recovery code when the user has a second factor.
 */
export interface CreateApiKeyRequest {
  name: string;
  /** 1–3650; omitted for a key that never expires. */
  expiresInDays?: number;
  access: ApiKeyAccess;
  password: string;
  code?: string;
}
