import { describe, expect, it } from 'vitest';
import {
  buildEndpointCodesModel,
  buildEndpointPhasesModel,
  codeColorVar,
  codeTone,
  endpointLabel,
  formatDeltaMs,
  hasNonSuccessCodes,
  phaseTotal,
  shortTemplate,
} from '@/utils/endpointStats';
import type { EndpointPhases, EndpointStat } from '@/data/metrics/MetricsDto';

function phases(over: Partial<EndpointPhases> = {}): EndpointPhases {
  return { dnsMs: 1, connectMs: 2, tlsMs: 3, ttfbMs: 4, transferMs: 5, responseMs: 15, ...over };
}

function endpoint(over: Partial<EndpointStat> = {}): EndpointStat {
  return {
    key: 'GET {p.baseUrl}/orders',
    method: 'GET',
    template: '{p.baseUrl}/orders',
    exampleUrl: 'https://api.example.com/orders',
    calls: 10,
    codes: [{ code: 200, count: 10 }],
    phases: phases(),
    previousPhases: null,
    avgSizeBytes: null,
    ...over,
  };
}

describe('shortTemplate', () => {
  it('drops a leading base-URL placeholder', () => {
    expect(shortTemplate('{p.baseUrl}/orders/{orderId}')).toBe('/orders/{orderId}');
    expect(shortTemplate('{o.host}/login')).toBe('/login');
  });

  it('drops a literal scheme and host', () => {
    expect(shortTemplate('https://api.example.com/v1/items')).toBe('/v1/items');
    expect(shortTemplate('HTTP://Api.Example.com/v1')).toBe('/v1');
  });

  it('keeps a template that is nothing but a placeholder or an origin', () => {
    expect(shortTemplate('{nextLink}')).toBe('{nextLink}');
    expect(shortTemplate('{expr}')).toBe('{expr}');
    expect(shortTemplate('https://api.example.com')).toBe('https://api.example.com');
  });

  it('clips from the left, keeping the tail that tells two paths apart', () => {
    const long = `{p.baseUrl}/${'a'.repeat(60)}/tail`;
    const short = shortTemplate(long, 20);
    expect(short).toHaveLength(20);
    expect(short.startsWith('…')).toBe(true);
    expect(short.endsWith('/tail')).toBe(true);
  });

  it('leaves a template that already fits alone', () => {
    expect(shortTemplate('{p.baseUrl}/orders', 20)).toBe('/orders');
  });
});

describe('endpointLabel', () => {
  it('is the method and the short template', () => {
    expect(endpointLabel(endpoint())).toBe('GET /orders');
    expect(endpointLabel(endpoint({ method: 'POST', template: '{p.baseUrl}/login' }))).toBe('POST /login');
  });
});

describe('codeTone', () => {
  it('classes a code by its hundred, with 0 on its own', () => {
    expect(codeTone(0)).toBe('noResponse');
    expect(codeTone(200)).toBe('success');
    expect(codeTone(204)).toBe('success');
    expect(codeTone(301)).toBe('redirect');
    expect(codeTone(404)).toBe('clientError');
    expect(codeTone(503)).toBe('serverError');
    expect(codeTone(100)).toBe('other');
    expect(codeTone(999)).toBe('other');
  });

  it('gives "no response" a token of its own, not the failure one', () => {
    expect(codeColorVar(0)).toBe('--chart-no-response');
    expect(codeColorVar(503)).toBe('--chart-failure');
    expect(codeColorVar(200)).toBe('--chart-success');
    expect(codeColorVar(302)).toBe('--chart-dimmed');
    expect(codeColorVar(404)).toBe('--chart-warning');
  });
});

describe('hasNonSuccessCodes', () => {
  it('is false for an all-2xx window', () => {
    expect(hasNonSuccessCodes([endpoint(), endpoint({ codes: [{ code: 204, count: 1 }] })])).toBe(false);
    expect(hasNonSuccessCodes([])).toBe(false);
  });

  it('is true as soon as one endpoint saw anything else', () => {
    expect(hasNonSuccessCodes([endpoint(), endpoint({ codes: [{ code: 0, count: 1 }] })])).toBe(true);
  });
});

describe('buildEndpointCodesModel', () => {
  const orders = endpoint({
    key: 'GET {p.baseUrl}/orders',
    calls: 100,
    codes: [{ code: 200, count: 90 }, { code: 503, count: 9 }, { code: 0, count: 1 }],
  });
  const login = endpoint({
    key: 'POST {p.baseUrl}/login',
    method: 'POST',
    template: '{p.baseUrl}/login',
    calls: 50,
    codes: [{ code: 200, count: 50 }],
  });

  it('keeps every endpoint and every code while nothing is hidden', () => {
    const model = buildEndpointCodesModel([orders, login], false);
    expect(model.rows).toHaveLength(2);
    expect(model.series.map(s => s.code)).toEqual([200, 503, 0]);
  });

  it('sorts codes ascending with 0 last, wherever it was seen', () => {
    const model = buildEndpointCodesModel(
      [endpoint({ codes: [{ code: 0, count: 1 }] }), endpoint({ codes: [{ code: 404, count: 1 }, { code: 200, count: 1 }] })],
      false,
    );
    expect(model.series.map(s => s.code)).toEqual([200, 404, 0]);
  });

  it('counts each code per endpoint and zero where it never happened', () => {
    const model = buildEndpointCodesModel([orders, login], false);
    expect(model.series[0].counts).toEqual([90, 50]);
    expect(model.series[1].counts).toEqual([9, 0]);
    expect(model.series[2].counts).toEqual([1, 0]);
  });

  it('gives each bar its share of that endpoint, not of the chart', () => {
    const model = buildEndpointCodesModel([orders, login], false);
    expect(model.series[0].shares).toEqual([90, 100]);
    expect(model.series[1].shares).toEqual([9, 0]);
  });

  it('drops the 2xx bars and the endpoints left with nothing to show', () => {
    const model = buildEndpointCodesModel([orders, login], true);
    expect(model.rows.map(r => r.key)).toEqual(['GET {p.baseUrl}/orders']);
    expect(model.series.map(s => s.code)).toEqual([503, 0]);
    expect(model.series[0].counts).toEqual([9]);
    expect(model.series[1].counts).toEqual([1]);
  });

  it('hides nothing into an empty chart when every endpoint is clean', () => {
    const model = buildEndpointCodesModel([login], true);
    expect(model.rows).toEqual([]);
    expect(model.series).toEqual([]);
  });

  it('never divides by a zero call count', () => {
    const model = buildEndpointCodesModel([endpoint({ calls: 0, codes: [{ code: 200, count: 0 }] })], false);
    expect(model.series[0].shares).toEqual([0]);
  });
});

describe('phaseTotal', () => {
  it('sums the five drawn segments, not the response time', () => {
    expect(phaseTotal(phases({ responseMs: 999 }))).toBe(15);
  });
});

describe('buildEndpointPhasesModel', () => {
  it('omits endpoints with no timings at all', () => {
    const model = buildEndpointPhasesModel([
      endpoint({ key: 'a', phases: null }),
      endpoint({ key: 'b' }),
    ]);
    expect(model.rows.map(r => r.key)).toEqual(['b']);
  });

  it('lays the five phases out in the order they happen', () => {
    const model = buildEndpointPhasesModel([endpoint()]);
    expect(model.series.map(s => s.phase)).toEqual(['dns', 'connect', 'tls', 'ttfb', 'transfer']);
    expect(model.series.map(s => s.values[0])).toEqual([1, 2, 3, 4, 5]);
  });

  it('measures each phase against the same phase of the previous period', () => {
    const model = buildEndpointPhasesModel([
      endpoint({ phases: phases({ ttfbMs: 82 }), previousPhases: phases({ ttfbMs: 44 }) }),
    ]);
    expect(model.series[3].deltas).toEqual([38]);
    expect(model.series[0].deltas).toEqual([0]);
    expect(model.previousTotals).toEqual([55]);
  });

  it('has neither a delta nor a marker without a previous period', () => {
    const model = buildEndpointPhasesModel([endpoint({ previousPhases: null })]);
    expect(model.series.map(s => s.deltas[0])).toEqual([null, null, null, null, null]);
    expect(model.previousTotals).toEqual([null]);
  });
});

describe('formatDeltaMs', () => {
  it('leads with the direction', () => {
    expect(formatDeltaMs(38)).toBe('+38ms');
    expect(formatDeltaMs(-12)).toBe('-12ms');
  });

  it('uses the shared duration format above a second', () => {
    expect(formatDeltaMs(1240)).toBe('+1.24s');
    expect(formatDeltaMs(-1240)).toBe('-1.24s');
  });

  it('says nothing changed without a sign', () => {
    expect(formatDeltaMs(0)).toBe('0ms');
  });
});
