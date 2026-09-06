import type { DateFormat } from '@/lib/dateFormat';

export interface OrgSettings {
  id: string;
  name: string;
  ownerId: string;
  totpRequired: boolean;
  /** Org-wide default IANA timezone (maintenance windows etc.). */
  defaultTimezone: string;
  /** Org-wide date format: `eu` (dd.mm.yyyy) or `us` (mm/dd/yyyy). */
  dateFormat: DateFormat;
}

export interface UpdateOrgSettingsRequest {
  name?: string;
  totpRequired?: boolean;
  defaultTimezone?: string;
  dateFormat?: DateFormat;
}
