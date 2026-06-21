import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOgImage } from '../src/index.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

/* PNG files start with the 8-byte signature \x89PNG\r\n\x1a\n. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (bytes) => PNG_MAGIC.every((b, i) => bytes[i] === b);

let fonts;
before(async () => {
  fonts = [
    { name: 'Inter', data: await readFile(path.join(dir, 'fixtures/Inter-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Inter', data: await readFile(path.join(dir, 'fixtures/Inter-Bold.ttf')), weight: 700, style: 'normal' },
  ];
});

// ── validation ──────────────────────────────

describe('renderOgImage — validation', () => {
  it('throws without a title', async () => {
    await assert.rejects(() => renderOgImage({}, { fonts }), /title/);
  });

  it('throws without fonts', async () => {
    await assert.rejects(() => renderOgImage({ title: 'Hi' }, {}), /fonts/);
    await assert.rejects(() => renderOgImage({ title: 'Hi' }, { fonts: [] }), /fonts/);
  });
});

// ── rendering ───────────────────────────────

describe('renderOgImage — output', () => {
  it('renders a PNG with just a title', async () => {
    const png = await renderOgImage({ title: 'Hello World' }, { fonts });
    assert.ok(png instanceof Uint8Array);
    assert.ok(isPng(png), 'output is a PNG');
    assert.ok(png.length > 1000, 'PNG has real content');
  });

  it('renders with eyebrow, subtitle, wordmark, domain and custom colours', async () => {
    const png = await renderOgImage(
      { title: 'Lush Pads Vol. 2', subtitle: '120 royalty-free samples', eyebrow: 'Sample pack' },
      { fonts, wordmark: 'WaveGrid', domain: 'wavegrid.app', colors: { accent: '#d1fe17' } },
    );
    assert.ok(isPng(png));
  });

  it('accepts a data: URI as artwork', async () => {
    // 1×1 transparent PNG.
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const png = await renderOgImage({ title: 'With art', artwork: dataUri }, { fonts });
    assert.ok(isPng(png));
  });

  it('respects custom dimensions', async () => {
    const png = await renderOgImage({ title: 'Square' }, { fonts, width: 600, height: 600 });
    assert.ok(isPng(png));
  });
});
