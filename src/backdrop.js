/**
 * @arraypress/og-image — the card's backdrop: soft colour glows and a film
 * grain over the background colour.
 *
 * Everything is drawn as layers of one CSS `background-image`, so the card's
 * element tree keeps its shape and the text needs no stacking order. A glow is
 * a radial gradient that fades along an eased curve to its own colour at zero
 * opacity: fading to `transparent` would pass through grey, and a straight
 * fade shows its edge. The grain is an SVG noise filter, which resvg renders.
 *
 * @module @arraypress/og-image/backdrop
 */

/** How a glow's opacity falls from its centre (first) to its edge (last). */
const FALLOFF = [1, 0.82, 0.55, 0.3, 0.12, 0.03, 0];

/** Grain opacity for `grain: true`. */
const DEFAULT_GRAIN = 0.08;

/**
 * A hex colour's red, green and blue, and its own alpha.
 *
 * @param {string} hex - `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.
 * @returns {{r: number, g: number, b: number, a: number}} Channels 0–255, alpha 0–1.
 * @throws {Error} When the colour isn't hex.
 */
export function parseHex(hex) {
  const m = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`og-image: backdrop colours must be hex (#rgb or #rrggbb), not "${hex}".`);
  const digits = m[1].length <= 4 ? [...m[1]].map((d) => d + d).join('') : m[1];
  const [r, g, b, a = 255] = digits.match(/../g).map((pair) => parseInt(pair, 16));
  return { r, g, b, a: a / 255 };
}

/**
 * One glow as a radial-gradient layer.
 *
 * @param {OgGlow} glow - The glow.
 * @param {number} width - The card's width, which `size` is a share of.
 * @returns {string} A `radial-gradient(…)` layer.
 * @throws {Error} When the colour isn't hex.
 */
export function glowLayer({ color, x = 50, y = 50, size = 50, opacity = 1 }, width) {
  const { r, g, b, a } = parseHex(color);
  const peak = a * opacity;
  const radius = Math.round((width * size) / 100);
  const stops = FALLOFF.map((k, i) => `rgba(${r}, ${g}, ${b}, ${+(peak * k).toFixed(3)}) ${Math.round((i / (FALLOFF.length - 1)) * 100)}%`);
  return `radial-gradient(circle ${radius}px at ${x}% ${y}%, ${stops.join(', ')})`;
}

/**
 * The film grain as an image layer: white specks over fractal noise, their
 * alpha following it, at most about `opacity`.
 * The noise is seeded, so the same card always renders the same bytes.
 *
 * @param {number} opacity - How strong, 0–1.
 * @param {number} width - The card's width.
 * @param {number} height - The card's height.
 * @returns {string} A `url(data:image/svg+xml…)` layer.
 */
export function grainLayer(opacity, width, height) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    '<filter id="g" x="0" y="0" width="100%" height="100%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" stitchTiles="stitch"/>' +
    // White specks whose alpha follows the noise, so the ground keeps its black.
    `<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${+(opacity * 4).toFixed(3)} 0 0 0 ${+(-opacity * 1.6).toFixed(3)}"/>` +
    '</filter><rect width="100%" height="100%" filter="url(#g)"/></svg>';
  return `url(data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')})`;
}

/**
 * The card's background layers for a `backdrop` option.
 *
 * @param {OgBackdrop|undefined} backdrop - The option.
 * @param {Object} card - The card.
 * @param {number} card.width - Its width.
 * @param {number} card.height - Its height.
 * @param {string} card.fallbackGlows - The layers to use when the backdrop
 *   names no glows of its own (the template's accent glows).
 * @returns {string|undefined} A `background-image` value, grain on top of the
 *   glows, or undefined when there are no layers.
 * @throws {Error} When a glow's colour isn't hex.
 */
export function backdropImage(backdrop, { width, height, fallbackGlows }) {
  const glows = backdrop?.glows ? backdrop.glows.map((glow) => glowLayer(glow, width)) : [fallbackGlows];
  const grain = backdrop?.grain === true ? DEFAULT_GRAIN : Number(backdrop?.grain) || 0;
  return [grain > 0 && grainLayer(grain, width, height), ...glows].filter(Boolean).join(', ') || undefined;
}
