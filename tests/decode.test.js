/**
 * @arraypress/og-image/decode — test suite.
 *
 * Satori can't draw WebP or AVIF; these check that such an image is either
 * converted or left off with a warning, never handed on to draw an empty tile.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { drawable, loadSharp } from '../src/decode.js';
import { sniffMime } from '../src/image.js';
import { renderOgImage } from '../src/index.js';

let webp;
let avif;
before(async () => {
  const red = { create: { width: 8, height: 8, channels: 3, background: '#ff0000' } };
  webp = new Uint8Array(await sharp(red).webp().toBuffer());
  avif = new Uint8Array(await sharp(red).avif().toBuffer());
});

/**
 * A warning collector.
 *
 * @returns {{warn: (message: string) => void, messages: string[]}} The function and what it was told.
 */
function collector() {
  const messages = [];
  return { warn: (message) => messages.push(message), messages };
}

describe('sniffMime', () => {
  it('knows WebP and AVIF', () => {
    assert.equal(sniffMime(webp), 'image/webp');
    assert.equal(sniffMime(avif), 'image/avif');
  });
});

describe('drawable', () => {
  it('converts WebP and AVIF bytes to PNG through sharp', async () => {
    for (const image of [webp, avif]) {
      const { warn, messages } = collector();
      const out = await drawable(image, 'artwork', warn);
      assert.equal(sniffMime(out), 'image/png');
      assert.deepEqual(messages, []);
    }
  });

  it('converts a base64 WebP data: URI', async () => {
    const uri = `data:image/webp;base64,${Buffer.from(webp).toString('base64')}`;
    assert.equal(sniffMime(await drawable(uri, 'artwork', () => {})), 'image/png');
  });

  it('leaves the image off, and says what to install, without sharp', async () => {
    const { warn, messages } = collector();
    assert.equal(await drawable(webp, 'artwork', warn, null), undefined);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /artwork is WEBP.*npm install sharp/);
  });

  it('leaves the image off when sharp cannot read it', async () => {
    const { warn, messages } = collector();
    const broken = webp.slice(0, 20);
    assert.equal(await drawable(broken, 'logo', warn), undefined);
    assert.match(messages[0], /logo is WEBP and sharp couldn't read it/);
  });

  it('passes everything else through untouched', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    for (const image of [undefined, 'https://example.com/a.webp', png]) assert.equal(await drawable(image, 'artwork', () => {}), image);
  });

  it('finds sharp', () => {
    assert.equal(typeof loadSharp(), 'function');
  });
});

describe('renderOgImage — WebP artwork', () => {
  it('draws it, with no warning', async () => {
    const { warn, messages } = collector();
    await renderOgImage({ title: 'Cover', artwork: webp }, { tile: 'artwork', onWarning: warn });
    assert.deepEqual(messages, []);
  });

  it('reports through onWarning', async () => {
    const { warn, messages } = collector();
    await renderOgImage({ title: 'Cover', artwork: webp.slice(0, 20) }, { tile: 'artwork', onWarning: warn });
    assert.equal(messages.length, 1);
  });
});
