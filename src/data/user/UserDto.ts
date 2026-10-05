
export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  totpEnabled: boolean;
  /**
   * False for an account that signs in only through a method a host application
   * provides and has never set a password. A server that predates the field
   * omits it — read the auth store's `hasPassword`, which treats that as true.
   */
  hasPassword?: boolean;
  selectedOrgId: string | null;
}

/**
 * Response of GET /me/export — the versioned personal data export envelope.
 * Section contents are downloaded verbatim, so they stay untyped here.
 */
export interface UserDataExport {
  exportVersion: number;
  generatedAt: string;
  [section: string]: unknown;
}
