/**
 * Chart.js setup shared by all chart components: one-time registration of the
 * pieces we use (mixed bar/line with legend + tooltips) and theme helpers that
 * resolve the CSS custom properties from `graphs.css` for canvas use.
 */

import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

let registered = false;

export function registerCharts() {
  if (registered) return;
  registered = true;
  Chart.register(
    BarController, 
    BarElement,
    LineController, 
    LineElement, 
    PointElement,
    CategoryScale, 
    LinearScale,
    // `fill: true` on a line dataset is a no-op without it, and Chart.js warns
    // on every render that the Filler plugin is missing.
    Filler,
    Legend, 
    Tooltip,
  );
}

/** Resolves a CSS custom property (e.g. `--chart-line`) to its value. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Appends an alpha channel to a #rrggbb color; other formats pass through. */
export function withAlpha(color: string, alphaHex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alphaHex}` : color;
}

/** Formats milliseconds for axis ticks / tooltips: `840ms` / `1.2s`. */
export function formatMsTick(value: number | string): string {
  const ms = Number(value);
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}
