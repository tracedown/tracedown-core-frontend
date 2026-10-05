/** One org audit-log entry (GET /audit-log). */
export interface AuditLogEntry {
  id: string;
  userId: string | null;
  /** Actor identity resolved server-side; null for system actions. */
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  /** What the entity was called at the time of the change; null for system-wide actions. */
  entityDisplayName: string | null;
  diff: string | null;
  comment: string | null;
  /** The API key the action came through, when it was not a signed-in session. */
  apiKeyId?: string | null;
  /** That key's name, while the key still exists. */
  apiKeyName?: string | null;
  createdAt: string;
}
