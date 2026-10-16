import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOgImage, buildCard } from '../src/index.js';
import { glowLayer, parseHex } from '../src/backdrop.js';
import { imageRatio } from '../src/image.js';

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
const body = (tree) => tree.props.children.at(-2); // [stripe?, body, footer]

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

  it('sniffs logo bytes, so an SVG logo is inlined as SVG', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const tree = buildCard({ title: 'X' }, { logo: svg });
    assert.match(imgNodes(tree)[0].props.src, /^data:image\/svg\+xml;base64,/);
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

// ── buildCard — backdrop ────────────────────

describe('buildCard — backdrop', () => {
  const background = (options) => buildCard({ title: 'X' }, options).props.style.backgroundImage;

  it('keeps the faint accent glows when there is no backdrop', () => {
    assert.match(background({ colors: { accent: '#d1fe17' } }), /^radial-gradient\(circle at 0% 0%, #d1fe1710/);
  });

  it('draws each glow as a radial gradient at its place and size', () => {
    const bg = background({ backdrop: { glows: [{ color: '#2f5bff', x: 10, y: 80, size: 40 }, { color: '#f5a524', x: 95, y: 5 }] } });
    const layers = bg.split(/, (?=radial-gradient|url)/);
    assert.equal(layers.length, 2);
    assert.match(layers[0], /^radial-gradient\(circle 480px at 10% 80%, rgba\(47, 91, 255, 1\) 0%/);
    assert.match(layers[1], /^radial-gradient\(circle 600px at 95% 5%, rgba\(245, 165, 36, 1\) 0%/);
    assert.doesNotMatch(bg, /#ffffff10|#00FFC210/i); // the accent glows are replaced
  });

  it('fades a glow to its own colour, not to transparent black', () => {
    const layer = glowLayer({ color: '#2f5bff', opacity: 0.5 }, 1200);
    assert.match(layer, /rgba\(47, 91, 255, 0\.5\) 0%/);
    assert.match(layer, /rgba\(47, 91, 255, 0\) 100%\)$/);
    assert.doesNotMatch(layer, /transparent/);
  });

  it('takes the colour\'s own alpha into the strength', () => {
    assert.match(glowLayer({ color: '#2f5bff80' }, 1200), /rgba\(47, 91, 255, 0\.502\) 0%/);
  });

  it('puts the grain on top, as an SVG noise image', () => {
    const bg = background({ backdrop: { grain: true, glows: [{ color: '#fff' }] } });
    assert.match(bg, /^url\(data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(bg.match(/base64,([^)]+)\)/)[1], 'base64').toString();
    assert.match(svg, /<feTurbulence[^>]+seed="7"/);
  });

  it('draws grain alone over the accent glows, and nothing at all for none of either', () => {
    assert.match(background({ backdrop: { grain: 0.1 } }), /^url\(.+radial-gradient\(circle at 0% 0%/);
    assert.equal(background({ backdrop: { glows: [] } }), undefined);
  });

  it('refuses a colour it cannot fade', () => {
    assert.throws(() => buildCard({ title: 'X' }, { backdrop: { glows: [{ color: 'rebeccapurple' }] } }), /hex/);
  });

  it('reads every hex form', () => {
    assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255, a: 1 });
    assert.deepEqual(parseHex('#0008'), { r: 0, g: 0, b: 0, a: 136 / 255 });
    assert.deepEqual(parseHex('#2f5bff'), { r: 47, g: 91, b: 255, a: 1 });
  });
});

// ── buildCard — stripe, fonts, logo ─────────

describe('buildCard — stripe, fonts and logo', () => {
  const stripe = (tree) => findAll(tree, (n) => n.props?.style?.height === '8px');

  it('draws the accent stripe unless told not to', () => {
    assert.equal(stripe(buildCard({ title: 'X' })).length, 1);
    const tree = buildCard({ title: 'X' }, { stripe: false, tile: 'none' });
    assert.equal(stripe(tree).length, 0);
    assert.equal(tree.props.children.length, 2); // body, footer
    assert.equal(body(tree).props.children.length, 1);
  });

  it('sets the text in fontFamily and the title and wordmark in displayFontFamily', () => {
    const tree = buildCard({ title: 'Title' }, { wordmark: 'Brand', fontFamily: 'Body', displayFontFamily: 'Display' });
    assert.equal(tree.props.style.fontFamily, 'Body');
    const display = findAll(tree, (n) => n.props?.style?.fontFamily === 'Display').map((n) => n.props.children);
    assert.deepEqual(display, ['Title', 'Brand']);
  });

  it('defaults both families to Inter', () => {
    const tree = buildCard({ title: 'Title' });
    assert.equal(tree.props.style.fontFamily, 'Inter');
    assert.equal(findAll(tree, (n) => n.props?.style?.fontFamily === 'Inter').length, 2); // card, title
  });

  it('draws a wide logo at its own proportions', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 270"/>');
    const [logo] = imgNodes(buildCard({ title: 'X' }, { logo: svg }));
    assert.equal(logo.props.height, 40);
    assert.equal(logo.props.width, 52);
  });

  it('keeps a logo it cannot measure square', () => {
    const [logo] = imgNodes(buildCard({ title: 'X' }, { logo: 'https://example.com/logo.png' }));
    assert.equal(logo.props.width, 40);
  });
});

describe('imageRatio', () => {
  it("reads an SVG's viewBox, else its width and height", () => {
    assert.equal(imageRatio(Buffer.from('<?xml version="1.0"?><svg viewBox="0 0 200 100"/>')), 2);
    assert.equal(imageRatio(Buffer.from('<svg width="30px" height="60"/>')), 0.5);
  });

  it("reads a PNG's header", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    png.set([0, 0, 1, 0x2c], 16); // 300
    png.set([0, 0, 0, 0x64], 20); // 100
    assert.equal(imageRatio(png), 3);
  });

  it('says nothing for URLs, other formats, or an SVG without a size', () => {
    assert.equal(imageRatio('https://example.com/a.svg'), undefined);
    assert.equal(imageRatio(new Uint8Array([0xff, 0xd8, 0, 0])), undefined);
    assert.equal(imageRatio(Buffer.from('<svg/>')), undefined);
  });
});

// ── renderOgImage — validation ──────────────

describe('renderOgImage — validation', () => {
  it('throws without a title', async () => {
    await assert.rejects(() => renderOgImage({}, { fonts }), /title/);
  });

  it('throws on an empty font list', async () => {
    await assert.rejects(() => renderOgImage({ title: 'Hi' }, { fonts: [] }), /fonts/);
    await assert.rejects(() => renderOgImage({ title: 'Hi' }, { fonts: 'Inter' }), /fonts/);
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

  it('renders with the bundled Inter when no fonts are given', async () => {
    const png = await renderOgImage({ title: 'No fonts passed', subtitle: 'Inter ships with the package' });
    assert.ok(isPng(png));
    assert.equal(pngWidth(png), 1200);
  });

  it('renders an SVG logo passed as bytes', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#fff"/></svg>');
    const png = await renderOgImage({ title: 'SVG logo' }, { fonts, logo: svg });
    assert.ok(isPng(png));
  });

  it('renders a backdrop of glows and grain', async () => {
    const png = await renderOgImage(
      { title: 'Glow' },
      { fonts, stripe: false, backdrop: { grain: true, glows: [{ color: '#2f5bff', x: 0, y: 80, size: 50 }, { color: '#f5a524', x: 100, y: 0 }] } },
    );
    assert.ok(isPng(png));
    assert.equal(pngWidth(png), 1200);
  });

  it('respects custom dimensions', async () => {
    const png = await renderOgImage({ title: 'Square' }, { fonts, width: 600, height: 600 });
    assert.ok(isPng(png));
    assert.equal(pngWidth(png), 600);
    assert.equal(pngHeight(png), 600);
  });
});
