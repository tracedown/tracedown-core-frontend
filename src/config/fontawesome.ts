import { config } from '@fortawesome/fontawesome-svg-core';

/**
 * Font Awesome 7 injects its stylesheet into `<head>` as an unlayered `<style>`
 * element. Unlayered CSS outranks every cascade layer, and Tailwind v4 ships
 * its utilities inside `@layer utilities` — so FA 7's new
 * `.svg-inline--fa { width: var(--fa-width, 1.25em) }` rule beats every `w-*`
 * class in the app and forces every icon to 1.25em regardless of the size the
 * template asked for. (FA 6 declared no width at all, so the utility applied.)
 *
 * Turning the auto-injection off lets `styles/style.css` import the same
 * stylesheet into a `fontawesome` layer ordered before `utilities`, which
 * restores normal precedence: an icon sized by a `w-*` class keeps that size,
 * and an icon with no width class falls back to FA's own default.
 *
 * Imported for its side effect before the app mounts — the config is read when
 * the first icon renders.
 */
config.autoAddCss = false;
