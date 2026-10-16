/**
 * @arraypress/og-image — the PNG a card is saved as.
 *
 * resvg writes every card as RGBA, with an alpha channel that on a card with
 * an opaque background is 255 from corner to corner. That channel is a
 * quarter of the pixels, and resvg's quick encoder leaves the rest poorly
 * filtered, so a card with glows and grain came out at 300 KB or more. An
 * opaque card is written here instead: RGB, each row given the PNG filter
 * that suits it best, then deflated. It's typically 40% smaller and takes
 * about a tenth of a second, with nothing to install.
 *
 * @module @arraypress/og-image/png
 */

import { deflateSync } from 'node:zlib';

/** The eight bytes every PNG starts with. */
const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/** Bytes per pixel in the RGB output. */
const BPP = 3;

/** CRC-32 of every byte value, for the chunk checksums. */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/**
 * CRC-32 over some byte arrays, as PNG chunks use it.
 *
 * @param {...Uint8Array} parts - The bytes, in order.
 * @returns {number} The checksum, unsigned.
 */
function crc32(...parts) {
  let c = 0xffffffff;
  for (const bytes of parts) for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * One PNG chunk: length, type, data, checksum.
 *
 * @param {string} type - The four-letter chunk type.
 * @param {Uint8Array} data - Its contents.
 * @returns {Buffer} The chunk.
 */
function chunk(type, data) {
  const name = Buffer.from(type, 'latin1');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  Buffer.from(data.buffer, data.byteOffset, data.byteLength).copy(out, 8);
  out.writeUInt32BE(crc32(name, data), 8 + data.length);
  return out;
}

/**
 * Whether every pixel is fully opaque.
 *
 * @param {Uint8Array} rgba - Pixels, four bytes each.
 * @returns {boolean} True when no alpha byte is below 255.
 */
function isOpaque(rgba) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) return false;
  return true;
}

/**
 * The Paeth predictor from the PNG specification.
 *
 * @param {number} a - The byte to the left.
 * @param {number} b - The byte above.
 * @param {number} c - The byte above and to the left.
 * @returns {number} Whichever of the three is nearest `a + b - c`.
 */
function paeth(a, b, c) {
  const pa = Math.abs(b - c);
  const pb = Math.abs(a - c);
  const pc = Math.abs(a + b - 2 * c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Filter every row with whichever of PNG's five filters leaves the smallest
 * sum of differences — libpng's heuristic, and most of the size saving.
 *
 * @param {Uint8Array} rgb - Pixels, three bytes each.
 * @param {number} width - Pixels per row.
 * @param {number} height - Rows.
 * @returns {Buffer} The rows, each led by its filter type, ready to deflate.
 */
function filterRows(rgb, width, height) {
  const stride = width * BPP;
  const out = Buffer.alloc((stride + 1) * height);
  const trial = Array.from({ length: 5 }, () => Buffer.alloc(stride));
  for (let y = 0; y < height; y++) {
    const row = rgb.subarray(y * stride, (y + 1) * stride);
    const above = y > 0 ? rgb.subarray((y - 1) * stride, y * stride) : undefined;
    let best = 0;
    let bestScore = Infinity;
    for (let filter = 0; filter < 5; filter++) {
      const bytes = trial[filter];
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= BPP ? row[x - BPP] : 0;
        const b = above ? above[x] : 0;
        const c = above && x >= BPP ? above[x - BPP] : 0;
        const predicted = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const value = (row[x] - predicted) & 0xff;
        bytes[x] = value;
        score += value < 128 ? value : 256 - value;
      }
      if (score < bestScore) {
        bestScore = score;
        best = filter;
      }
    }
    out[y * (stride + 1)] = best;
    trial[best].copy(out, y * (stride + 1) + 1);
  }
  return out;
}

/**
 * Encode pixels as an RGB PNG, when they're opaque.
 *
 * @param {Uint8Array} rgba - Pixels, four bytes each (resvg's `pixels`).
 * @param {number} width - Pixels per row.
 * @param {number} height - Rows.
 * @returns {Uint8Array|undefined} The PNG, or undefined when any pixel is
 *   see-through and the alpha channel has to stay.
 * @throws {RangeError} When the pixel count doesn't match the size.
 */
export function opaquePng(rgba, width, height) {
  if (rgba.length !== width * height * 4) throw new RangeError(`opaquePng: ${rgba.length} bytes is not ${width}×${height} RGBA.`);
  if (!isOpaque(rgba)) return undefined;

  const rgb = new Uint8Array(width * height * BPP);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += BPP) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // colour type: RGB

  const data = deflateSync(filterRows(rgb, width, height), { level: 6, memLevel: 9 });
  return new Uint8Array(Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', data), chunk('IEND', new Uint8Array(0))]));
}
