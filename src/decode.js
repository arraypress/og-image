/**
 * @arraypress/og-image — images Satori can't read.
 *
 * Satori draws PNG, JPEG, GIF and SVG. A WebP or AVIF cover, which is what
 * most image pipelines now emit, came out as an empty tile. When `sharp` is
 * installed (an optional peer, and already in any Astro project that
 * optimises images), those are converted to PNG first. Without it the image
 * is dropped, with a warning that says what to install, so the card falls
 * back to its initials or no tile rather than an empty frame.
 *
 * @module @arraypress/og-image/decode
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { sniffMime } from './image.js';

/** Types Satori can't draw, which sharp can turn into a PNG. */
const NEEDS_DECODING = new Set(['image/webp', 'image/avif']);

/* sharp, once looked for: the module, or null when it isn't installed. */
let sharpModule;

/**
 * Load `sharp`, from this package's own dependencies or, failing that, the
 * project being built (the working directory) — a linked or hoisted install
 * can leave it out of reach of one but not the other.
 *
 * @returns {Function|null} sharp, or null when it isn't installed.
 */
export function loadSharp() {
  if (sharpModule !== undefined) return sharpModule;
  sharpModule = null;
  for (const from of [import.meta.url, join(process.cwd(), 'package.json')]) {
    try {
      sharpModule = createRequire(from)('sharp');
      break;
    } catch {
      // Not installed here; try the next place.
    }
  }
  return sharpModule;
}

/**
 * An image's bytes and type, from bytes or a base64 `data:` URI. URLs aren't
 * fetched: Satori loads those itself.
 *
 * @param {string|Uint8Array|ArrayBuffer|undefined} image - The image option.
 * @returns {{bytes: Uint8Array, mime: string}|undefined} Its bytes and sniffed
 *   type, or undefined for a URL or nothing.
 */
function bytesOf(image) {
  if (!image) return undefined;
  if (typeof image === 'string') {
    const m = image.match(/^data:[^;,]*;base64,(.*)$/s);
    if (!m) return undefined;
    const bytes = new Uint8Array(Buffer.from(m[1], 'base64'));
    return { bytes, mime: sniffMime(bytes) };
  }
  const bytes = image instanceof Uint8Array ? image : new Uint8Array(image);
  return { bytes, mime: sniffMime(bytes) };
}

/**
 * Make an image drawable: a WebP or AVIF becomes PNG bytes through sharp;
 * anything else is returned as it came.
 *
 * @param {string|Uint8Array|ArrayBuffer|undefined} image - Artwork or a logo.
 * @param {string} label - What it is, for the warning (`'artwork'`, `'logo'`).
 * @param {(message: string) => void} warn - Where to say an image was dropped.
 * @param {Function|null} [sharp] - sharp, or null for none. Defaults to
 *   {@link loadSharp}'s; tests pass their own.
 * @returns {Promise<string|Uint8Array|ArrayBuffer|undefined>} The image, or
 *   undefined when it can't be drawn.
 */
export async function drawable(image, label, warn, sharp = loadSharp()) {
  const found = bytesOf(image);
  if (!found || !NEEDS_DECODING.has(found.mime)) return image;

  const type = found.mime.slice('image/'.length).toUpperCase();
  if (!sharp) {
    warn(`og-image: the ${label} is ${type}, which Satori can't draw; left off the card. Install sharp (npm install sharp) to convert it, or use PNG, JPEG or SVG.`);
    return undefined;
  }
  try {
    return new Uint8Array(await sharp(found.bytes).png().toBuffer());
  } catch (error) {
    warn(`og-image: the ${label} is ${type} and sharp couldn't read it (${error.message}); left off the card.`);
    return undefined;
  }
}
