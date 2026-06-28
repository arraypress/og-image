import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOgImage, buildCard } from '../src/index.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

/* PNG files start with the 8-byte signature \x89PNG\r\n\x1a\n. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (bytes) => PNG_MAGIC.every((b, i) => bytes[i] === b);

/* Width/height live in the IHDR chunk: bytes 16–19 (W) and 20–23 (H), big-endian. */
const pngWidth = (b) => (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
const pngHeight = (b) => (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];

let fonts;
before(async () => {
  fonts = [
    { name: 'Inter', data: await readFile(path.join(dir, 'fixtures/Inter-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Inter', data: await readFile(path.join(dir, 'fixtures/Inter-Bold.ttf')), weight: 700, style: 'normal' },
  ];
});

// ── tree helpers (Satori rasterises text to paths, so we assert on the tree) ──

/** Collect every string text leaf in the element tree. */
function textLeaves(node, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  const c = node.props?.children;
  if (typeof c === 'string') acc.push(c);
  else if (Array.isArray(c)) c.forEach((ch) => textLeaves(ch, acc));
  else if (c && typeof c === 'object') textLeaves(c, acc);
  return acc;
}
/** Find every node matching `pred`. */
function findAll(node, pred, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  if (pred(node)) acc.push(node);
  const c = node.props?.children;
  if (Array.isArray(c)) c.forEach((ch) => findAll(ch, pred, acc));
  else if (c && typeof c === 'object') findAll(c, pred, acc);
  return acc;
}
const chipNodes = (tree) => findAll(tree, (n) => n.props?.style?.borderRadius === '999px');
const imgNodes = (tree) => findAll(tree, (n) => n.type === 'img');
const tileNodes = (tree) => findAll(tree, (n) => n.props?.style?.width === '340px' && n.props?.style?.height === '340px');
const body = (tree) => tree.props.children[1]; // [stripe, body, footer]

// ── buildCard — chips ───────────────────────

describe('buildCard — chips', () => {
  it('renders one pill per chip with the chip text', () => {
    const tree = buildCard({ title: 'The Healer', chips: ['Compassionate', 'Soothing', 'Nurturing'] });
    const chips = chipNodes(tree);
    assert.equal(chips.length, 3);
    assert.deepEqual(chips.map((c) => c.props.children), ['Compassionate', 'Soothing', 'Nurturing']);
    assert.ok(textLeaves(tree).includes('Soothing'));
  });

  it('caps chips at maxChips (default 3)', () => {
    const tree = buildCard({ title: 'X', chips: ['a', 'b', 'c', 'd', 'e'] });
    assert.deepEqual(chipNodes(tree).map((c) => c.props.children), ['a', 'b', 'c']);
  });

  it('respects a custom maxChips', () => {
    const tree = buildCard({ title: 'X', chips: ['a', 'b', 'c', 'd'] }, { maxChips: 2 });
    assert.equal(chipNodes(tree).length, 2);
  });

  it('drops empty/blank chips', () => {
    const tree = buildCard({ title: 'X', chips: ['a', '', '   ', 'b'] });
    assert.deepEqual(chipNodes(tree).map((c) => c.props.children), ['a', 'b']);
  });

  it('renders no chip row when chips are absent or empty', () => {
    assert.equal(chipNodes(buildCard({ title: 'X' })).length, 0);
    assert.equal(chipNodes(buildCard({ title: 'X', chips: [] })).length, 0);
  });
});

// ── buildCard — tile modes ──────────────────

describe('buildCard — tile modes', () => {
  it("'auto' (default) shows a tile — initials when there's no artwork", () => {
    const tree = buildCard({ title: 'X' }, { wordmark: 'Personality Tests' });
    assert.equal(tileNodes(tree).length, 1);
    assert.equal(imgNodes(tree).length, 0); // initials, not an image
    assert.equal(body(tree).props.children.length, 2); // left + tile
    assert.ok(textLeaves(tree).includes('PER')); // initials from wordmark
  });

  it("'auto' shows the artwork image when artwork is provided", () => {
    const tree = buildCard({ title: 'X', artwork: 'https://example.com/a.png' });
    assert.equal(tileNodes(tree).length, 1);
    assert.equal(imgNodes(tree).length, 1);
    assert.equal(imgNodes(tree)[0].props.src, 'https://example.com/a.png');
  });

  it("'none' never shows a tile — text runs full-width", () => {
    const tree = buildCard({ title: 'X', artwork: 'https://example.com/a.png' }, { tile: 'none' });
    assert.equal(tileNodes(tree).length, 0);
    assert.equal(body(tree).props.children.length, 1); // left only
  });

  it("'artwork' shows a tile only when artwork exists", () => {
    const withArt = buildCard({ title: 'X', artwork: 'https://example.com/a.png' }, { tile: 'artwork' });
    assert.equal(tileNodes(withArt).length, 1);
    assert.equal(imgNodes(withArt).length, 1);

    const without = buildCard({ title: 'X' }, { tile: 'artwork', wordmark: 'PT' });
    assert.equal(tileNodes(without).length, 0); // no initials fallback
    assert.equal(body(without).props.children.length, 1);
  });

  it('inlines raw artwork bytes as a data URI', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    const tree = buildCard({ title: 'X', artwork: png });
    assert.match(imgNodes(tree)[0].props.src, /^data:image\/png;base64,/);
  });
});

// ── buildCard — text ────────────────────────

describe('buildCard — text', () => {
  it('truncates a long title with an ellipsis', () => {
    const long = 'A'.repeat(120);
    const tree = buildCard({ title: long }, { titleMaxLength: 40 });
    const all = textLeaves(tree).join('');
    assert.ok(all.includes('…'));
    assert.ok(!all.includes('A'.repeat(120)));
  });

  it('includes eyebrow and subtitle when provided', () => {
    const tree = buildCard({ title: 'T', eyebrow: 'Lightworker', subtitle: 'An archetype' });
    const all = textLeaves(tree);
    assert.ok(all.includes('Lightworker'));
    assert.ok(all.includes('An archetype'));
  });
});

// ── renderOgImage — validation ──────────────

describe('renderOgImage — validation', () => {
  it('throws without a title', async () => {
    await assert.rejects(() => renderOgImage({}, { fonts }), /title/);
  });

  it('throws without fonts', async () => {
    await assert.rejects(() => renderOgImage({ title: 'Hi' }, {}), /fonts/);
    await assert.rejects(() => renderOgImage({ title: 'Hi' }, { fonts: [] }), /fonts/);
  });
});

// ── renderOgImage — output ──────────────────

describe('renderOgImage — output', () => {
  it('renders a PNG with just a title (default 1200×630)', async () => {
    const png = await renderOgImage({ title: 'Hello World' }, { fonts });
    assert.ok(png instanceof Uint8Array);
    assert.ok(isPng(png), 'output is a PNG');
    assert.ok(png.length > 1000, 'PNG has real content');
    assert.equal(pngWidth(png), 1200);
    assert.equal(pngHeight(png), 630);
  });

  it('renders with eyebrow, subtitle, wordmark, domain and custom colours', async () => {
    const png = await renderOgImage(
      { title: 'Lush Pads Vol. 2', subtitle: '120 royalty-free samples', eyebrow: 'Sample pack' },
      { fonts, wordmark: 'WaveGrid', domain: 'wavegrid.app', colors: { accent: '#d1fe17' } },
    );
    assert.ok(isPng(png));
  });

  it('renders with keyword chips', async () => {
    const png = await renderOgImage(
      { title: 'The Healer', subtitle: 'A lightworker archetype', chips: ['Compassionate', 'Soothing', 'Nurturing'] },
      { fonts, wordmark: 'Personality Tests', tile: 'none', colors: { accent: '#d1fe17' } },
    );
    assert.ok(isPng(png));
  });

  it("renders tile:'none' full-width text", async () => {
    const png = await renderOgImage({ title: 'No tile here' }, { fonts, tile: 'none' });
    assert.ok(isPng(png));
  });

  it("renders tile:'artwork' with a data: URI", async () => {
    // 1×1 transparent PNG.
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const png = await renderOgImage({ title: 'With art', artwork: dataUri }, { fonts, tile: 'artwork' });
    assert.ok(isPng(png));
  });

  it('respects custom dimensions', async () => {
    const png = await renderOgImage({ title: 'Square' }, { fonts, width: 600, height: 600 });
    assert.ok(isPng(png));
    assert.equal(pngWidth(png), 600);
    assert.equal(pngHeight(png), 600);
  });
});
