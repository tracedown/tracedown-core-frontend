/**
 * Bounds for a chart axis that plots a percentage.
 *
 * A percentage cannot leave 0–100, but an auto-scaled axis does not know that:
 * a series that sits flat at 100 has no range, so the scale pads it on both
 * sides and labels the top 106%. The bounds returned here keep the automatic
 * scaling — small dips near 100 stay visible, a 0.2% error rate is not squashed
 * onto a 0–100 axis — and only pin the end the data has actually reached.
 */
export interface PercentAxisBounds {
  min?: number;
  max?: number;
  suggestedMin?: number;
  suggestedMax?: number;
}

function finite(values: readonly (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

/** Uptime-style series: lives near 100, never above it. */
export function upperPercentBounds(values: readonly (number | null | undefined)[]): PercentAxisBounds {
  const present = finite(values);
  const lowest = present.length ? Math.min(...present) : 100;
  // Flat at 100: give the line a percent of room underneath instead of a padded top.
  return lowest >= 100 ? { max: 100, suggestedMin: 99 } : { max: 100 };
}

/** Error-rate-style series: lives near 0, never below it, and never above 100. */
export function lowerPercentBounds(values: readonly (number | null | undefined)[]): PercentAxisBounds {
  const present = finite(values);
  const highest = present.length ? Math.max(...present) : 0;
  // Only a series that has reached the top needs the cap; pinning 100 always
  // would flatten every ordinary error rate against the bottom of the chart.
  return highest > 90 ? { min: 0, max: 100 } : { min: 0, suggestedMax: 1 };
}
