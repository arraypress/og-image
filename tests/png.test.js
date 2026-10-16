/**
 * @arraypress/og-image/png — test suite.
 *
 * The encoder only earns its place if its PNGs decode to exactly the pixels
 * it was given, so most of these round-trip through sharp.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { opaquePng } from '../src/png.js';
import { renderOgImage } from '../src/index.js';

/** The colour type byte in a PNG's IHDR: 2 is RGB, 6 is RGBA. */
const colourType = (png) => png[25];

/**
 * Pixels for a test image: a gradient with some noise, so every filter gets used.
 *
 * @param {number} width - Pixels per row.
 * @param {number} height - Rows.
 * @param {number} [alpha=255] - Every pixel's alpha.
 * @returns {Uint8Array} RGBA pixels.
 */
function pixels(width, height, alpha = 255) {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      out[i] = (x * 7) & 0xff;
      out[i + 1] = (y * 13) & 0xff;
      out[i + 2] = (x * y + ((x * 31) ^ (y * 17))) & 0xff;
      out[i + 3] = alpha;
    }
  }
  return out;
}

describe('opaquePng', () => {
  it('writes an RGB PNG that decodes to the same pixels', async () => {
    const rgba = pixels(37, 23);
    const png = opaquePng(rgba, 37, 23);
    assert.equal(colourType(png), 2);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [37, 23, 3]);
    const rgb = rgba.filter((_, i) => i % 4 !== 3);
    assert.deepEqual(new Uint8Array(data), rgb);
  });

  it('gives back nothing when a pixel is see-through', () => {
    const rgba = pixels(4, 4);
    rgba[4 * 5 + 3] = 254;
    assert.equal(opaquePng(rgba, 4, 4), undefined);
  });

  it('refuses pixels that are not the size given', () => {
    assert.throws(() => opaquePng(new Uint8Array(12), 2, 2), RangeError);
  });
});

describe('renderOgImage — the saved PNG', () => {
  it('is RGB for an opaque card, and smaller than the RGBA resvg writes', async () => {
    const card = { title: 'Glow and grain', subtitle: 'The heaviest kind of card' };
    const options = { backdrop: { grain: true, glows: [{ color: '#2f5bff', x: 0, y: 80, size: 50 }] } };
    const png = await renderOgImage(card, options);
    assert.equal(colourType(png), 2);
    const rgba = await sharp(png).ensureAlpha().png({ compressionLevel: 3 }).toBuffer();
    assert.ok(png.length < rgba.length, `${png.length} should be under ${rgba.length}`);
  });

  it('keeps the alpha channel for a card with a see-through background', async () => {
    const png = await renderOgImage({ title: 'Clear' }, { colors: { bg: 'transparent' }, backdrop: { glows: [] } });
    assert.equal(colourType(png), 6);
  });
});
