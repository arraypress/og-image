/**
 * @arraypress/og-image — images for the card.
 *
 * Satori can't read from disk, so every image reaches it as a URL or a `data:`
 * URI. These turn the bytes a caller reads from a file into one, and read a
 * logo's shape so it's drawn at its own proportions.
 *
 * @module @arraypress/og-image/image
 */

/**
 * Sniff an image MIME type from its leading magic bytes, so raw bytes can be
 * inlined as a data URI.
 *
 * @param {Uint8Array} bytes - The image file's bytes.
 * @returns {string} The MIME type, PNG when nothing matches.
 */
export function sniffMime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'image/webp';
  if (bytes[0] === 0x3c) return 'image/svg+xml';
  return 'image/png';
}

/**
 * Resolve an image option to something Satori's `<img src>` accepts. An
 * http(s) URL or `data:` URI passes through untouched; raw bytes are sniffed
 * and base64-encoded into a data URI.
 *
 * @param {string|Uint8Array|ArrayBuffer|undefined} image - URL, data URI or bytes.
 * @returns {string|undefined} A src for `<img>`, or undefined when absent.
 */
export function resolveImage(image) {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  const bytes = image instanceof Uint8Array ? image : new Uint8Array(image);
  return `data:${sniffMime(bytes)};base64,${Buffer.from(bytes).toString('base64')}`;
}

/**
 * Width over height of an SVG, from its `viewBox`, else its `width` and
 * `height` attributes.
 *
 * @param {string} svg - The SVG source.
 * @returns {number|undefined} The ratio, or undefined when the root says neither.
 */
function svgRatio(svg) {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) return undefined;
  const box = root.match(/\bviewBox\s*=\s*["']\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i);
  if (box) return Number(box[1]) / Number(box[2]);
  const width = root.match(/\bwidth\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
  const height = root.match(/\bheight\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
  return width && height ? Number(width[1]) / Number(height[1]) : undefined;
}

/**
 * Width over height of an image given as bytes. Reads an SVG's `viewBox` (or
 * `width`/`height`) and a PNG's header; anything else is unknown.
 *
 * @param {string|Uint8Array|ArrayBuffer|undefined} image - The image, as bytes.
 *   URLs and data URIs aren't read.
 * @returns {number|undefined} The ratio, or undefined when it can't be told.
 */
export function imageRatio(image) {
  if (!image || typeof image === 'string') return undefined;
  const bytes = image instanceof Uint8Array ? image : new Uint8Array(image);
  let ratio;
  if (sniffMime(bytes) === 'image/svg+xml') ratio = svgRatio(Buffer.from(bytes).toString('utf8'));
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length >= 24) {
    // IHDR: width, then height, as big-endian 32-bit integers from byte 16.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    ratio = view.getUint32(16) / view.getUint32(20);
  }
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}
