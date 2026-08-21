/** One org domain (GET /domains). */
export interface DomainSummary {
  id: string;
  domain: string;
  challenge: string;
  verificationType: string;
  status: string;
  verifiedAt: string | null;
  wildcardEnabled: boolean;
  exceptions: string[];
  lastCheckedAt: string | null;
  /** Previously verified but the token disappeared — unverified limits apply. */
  lapsed: boolean;
  /** How the DNS record was placed: a provider id, a host's own method, or null for by hand. */
  dnsSetupMethod: string | null;
  dnsSetupAt: string | null;
}

/** Request of POST /domains. */
export interface CreateDomainRequest {
  domain: string;
  verificationType?: string;
  wildcardEnabled?: boolean;
}

/** Response of POST /domains/{id}/verify. */
export interface VerifyDomainResponse {
  verified: boolean;
  status: string;
  error?: string | null;
}

/** Where to send someone so their own DNS provider takes the record. */
export interface DnsHandoff {
  /** `dashboard` — a deep link to this zone's DNS page. `none` — unrecognised. */
  mode: 'dashboard' | 'none';
  providerName?: string | null;
  url?: string | null;
}
