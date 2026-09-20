import { describe, expect, it } from 'vitest';
import { lowerPercentBounds, upperPercentBounds } from './percentAxis';

describe('upperPercentBounds', () => {
  it('never lets the axis pass 100', () => {
    expect(upperPercentBounds([100, 100, 100]).max).toBe(100);
    expect(upperPercentBounds([99.2, 100, 97]).max).toBe(100);
    expect(upperPercentBounds([]).max).toBe(100);
  });

  it('gives a flat 100 line room underneath rather than padding above', () => {
    expect(upperPercentBounds([100, 100])).toEqual({ max: 100, suggestedMin: 99 });
    expect(upperPercentBounds([100, null, undefined])).toEqual({ max: 100, suggestedMin: 99 });
  });

  it('leaves the lower end to auto-scaling once there is a dip to show', () => {
    expect(upperPercentBounds([100, 98.5])).toEqual({ max: 100 });
  });
});

describe('lowerPercentBounds', () => {
  it('keeps a small error rate readable', () => {
    expect(lowerPercentBounds([0, 0.2, 0])).toEqual({ min: 0, suggestedMax: 1 });
    expect(lowerPercentBounds([])).toEqual({ min: 0, suggestedMax: 1 });
  });

  it('caps at 100 when the series reaches the top', () => {
    expect(lowerPercentBounds([100, 100])).toEqual({ min: 0, max: 100 });
    expect(lowerPercentBounds([3, 96])).toEqual({ min: 0, max: 100 });
  });
});
