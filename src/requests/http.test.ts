import { describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { createHttp } from '@/requests/http';

/** The global 5xx hook, and the per-call opt-out for callers that explain the failure themselves. */

function failingHttp(status: number) {
  const onServerError = vi.fn();
  const http = createHttp<string>({
    baseUrl: '/api',
    wsUrl: () => undefined,
    wsMaxRetries: 0,
    authToken: () => undefined,
    resolveMessage: code => `msg:${code}`,
    onServerError,
  });
  http.instance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const response = { status, data: { error: 'upstream_down' }, config, headers: {}, statusText: '' } as AxiosResponse;
    throw new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, response);
  };
  return { http, onServerError };
}

describe('server errors', () => {
  it('reach the host hook by default', async () => {
    const { http, onServerError } = failingHttp(502);

    const res = await http.post('/x', {}, { disableLoading: true });

    expect(res.errorInfo).toEqual({ code: 'upstream_down', message: 'msg:upstream_down' });
    expect(onServerError).toHaveBeenCalledWith({ code: 'upstream_down', message: 'msg:upstream_down' });
  });

  it('stay with the caller when it suppresses them', async () => {
    const { http, onServerError } = failingHttp(503);

    const res = await http.get('/x', { disableLoading: true, suppressServerError: true });

    expect(res.success).toBe(false);
    expect(res.errorInfo?.code).toBe('upstream_down');
    expect(onServerError).not.toHaveBeenCalled();
  });
});
