/**
 * Public contract of the requests library.
 *
 * The library is host-agnostic: it never imports app code. Everything it needs
 * from the host application (base URL, auth token, navigation hooks, error-code
 * resolution) is supplied once via {@link RequestHost} when `createRequests` is
 * called. The error-code vocabulary lives in the host; the library only owns the
 * transport-level codes it can detect itself ({@link TransportErrorCode}).
 */

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * Error codes the transport layer can detect without backend involvement.
 * The host's error-code union must include these so resolution stays total.
 */
export type TransportErrorCode = 'internet_down' | 'unknown_error';

export interface ErrorInfo<Code extends string> {
  code: Code;
  message: string;
  /** Structured context the backend sent with the code (`details`), if any. */
  details?: Record<string, unknown>;
}

export interface ApiResponse<T, Code extends string> {
  success: boolean;
  data?: T;
  errorInfo?: ErrorInfo<Code>;
}

/** Per-request options forwarded to the transport. */
export interface RequestOptions {
  /** Skip any host-level loading indicator for this call. */
  disableLoading?: boolean;
  /**
   * Skip {@link RequestHost.onUnauthorized} on a 401 (e.g. a logout revoke
   * racing an already-expired session must not trigger the global redirect).
   */
  suppressUnauthorized?: boolean;
  /** On a 404, invoke {@link RequestHost.onNotFound} (e.g. route to not-found). */
  redirectOnNotFound?: boolean;
  /** Extra headers merged onto the request. */
  headers?: Record<string, string>;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Everything the library needs from the host application. Supplied once to
 * `createRequests`. `Code` is the host's full error-code union (which must
 * include the {@link TransportErrorCode} values so resolution stays total).
 */
export interface RequestHost<Code extends string> {
  /** Axios base URL for all calls. */
  baseUrl: string | undefined;
  /** Realtime-service WebSocket URL, or undefined to force polling mode. */
  wsUrl: () => string | undefined;
  /**
   * Max WebSocket (re)connection attempts before settling on HTTP polling.
   * 0 disables WebSockets entirely — the connection goes straight to polling.
   */
  wsMaxRetries: number;
  /** Current bearer token, or undefined when unauthenticated. */
  authToken: () => string | undefined;
  /** Resolves a backend/transport error code to a user-facing message. */
  resolveMessage: (code: Code) => string;
  /** Invoked once per 401, regardless of which layer issued the request. */
  onUnauthorized?: () => void;
  /** Invoked on a 404 when the call set `redirectOnNotFound`. */
  onNotFound?: () => void;
  /** Invoked on every 5xx with the resolved error (e.g. to toast it globally). */
  onServerError?: (error: ErrorInfo<Code>) => void;
  /** Optional loading hooks, driven unless a call sets `disableLoading`. */
  onLoadingStart?: () => void;
  onLoadingStop?: () => void;
}

// ── Bulk ──

export interface BulkSubRequest {
  method: string;
  url: string;
  body?: unknown;
}

export interface BulkSubResponse {
  status: number;
  body: unknown;
}

export interface BulkCallResult {
  index: number;
  request: BulkSubRequest;
  response: BulkSubResponse;
}

export interface BulkResponse {
  calls: BulkCallResult[];
}
