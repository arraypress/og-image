# @arraypress/og-image

Build-time Open Graph image renderer — one [Satori](https://github.com/vercel/satori) (HTML/JSX-like tree → SVG) + [@resvg/resvg-js](https://github.com/yisibl/resvg-js) (SVG → PNG) template that fits products, posts, news, or anything else.

Eyebrow + title + subtitle (+ optional keyword chips) on the left, an optional artwork tile (or initials) on the right, a wordmark/domain footer. Brand surfaces and fonts are passed in, so it has **no dependency on any site config** — your route resolves those and hands them over. Pure build-time: no adapter, no runtime JS.

## Install

```bash
npm install @arraypress/og-image
```

## Usage

### `renderOgImage(input, options)`

Render a 1200×630 card to PNG bytes.

```js
import { renderOgImage } from '@arraypress/og-image';
import { readFile } from 'node:fs/promises';

const fonts = [
  { name: 'Inter', data: await readFile('Inter-Regular.ttf'), weight: 400, style: 'normal' },
  { name: 'Inter', data: await readFile('Inter-Bold.ttf'),    weight: 700, style: 'normal' },
];

const png = await renderOgImage(
  { title: 'Lush Pads Vol. 2', subtitle: '120 royalty-free samples', eyebrow: 'Sample pack' },
  { fonts, wordmark: 'WaveGrid', domain: 'wavegrid.app', colors: { accent: '#d1fe17' } },
);
```

In an Astro static endpoint (`src/pages/og/[…].png.ts`):

```ts
export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage(props, { fonts, wordmark: siteConfig.name, domain });
  return new Response(png as unknown as BodyInit, { headers: { 'Content-Type': 'image/png' } });
};
```

### `input`

| Field | Type | Notes |
|---|---|---|
| `title` | `string` | **Required.** Headline. Truncated at `titleMaxLength`. |
| `subtitle` | `string?` | Sub-line. Truncated at `subtitleMaxLength`. |
| `eyebrow` | `string?` | Small uppercase accent label above the title. |
| `chips` | `string[]?` | Short keyword pills under the subtitle. Capped at `maxChips`; blank entries dropped. |
| `artwork` | `string \| Uint8Array \| Buffer ?` | Right tile: an http(s) URL, a `data:` URI, or raw image bytes (MIME is sniffed). Falls back to `initials` (see `tile`). |

### `options`

| Field | Type | Default |
|---|---|---|
| `fonts` | `OgFont[]` | **Required** — Satori needs ≥1 font. Use `.ttf`/`.otf`/`.woff` (**not** woff2). |
| `colors` | `OgColors?` | merged over defaults (`bg`, `cardBg`, `accent`, `text`, `textSoft`, `muted`, `border`) |
| `wordmark` | `string?` | `''` — footer text + source for default initials |
| `domain` | `string?` | — footer-right text |
| `initials` | `string?` | first 3 letters of `wordmark` |
| `wordmarkInitial` | `string?` | first letter of `wordmark` |
| `tile` | `'auto' \| 'artwork' \| 'none'` | `'auto'` — see below |
| `maxChips` | `number?` | `3` |
| `titleMaxLength` | `number?` | `80` |
| `subtitleMaxLength` | `number?` | `140` |
| `width` / `height` | `number?` | `1200` / `630` |

### Keyword chips & tile modes

Add small pill tags under the subtitle, and control whether the right-hand tile shows at all:

```js
// Text-forward card with keyword chips and no tile (content runs full-width)
await renderOgImage(
  { title: 'The Healer', subtitle: 'A lightworker archetype', chips: ['Compassionate', 'Soothing', 'Nurturing'] },
  { fonts, wordmark: 'Personality Tests', tile: 'none' },
);

// Character/art on the card when present, full-width text when not
await renderOgImage(
  { title: 'The Wolf', subtitle: 'Your spirit animal', chips: ['Loyal', 'Instinctive', 'Free'], artwork: pngBytes },
  { fonts, wordmark: 'Personality Tests', tile: 'artwork' },
);
```

`tile`:
- **`'auto'`** (default) — always a tile: the artwork, or initials when absent. *(Back-compatible.)*
- **`'artwork'`** — a tile only when `artwork` is provided; otherwise the text runs full-width (no initials).
- **`'none'`** — never a tile; the text always runs full-width.

### `buildCard(input, options?)`

The pure, synchronous tree builder behind `renderOgImage` — returns the Satori element tree and needs **no fonts**. Useful for advanced rendering, or for unit tests (Satori rasterises text to glyph paths, so the rendered PNG/SVG can't be asserted on for content; assert on the tree instead).

```js
import { buildCard } from '@arraypress/og-image';

const tree = buildCard({ title: 'The Healer', chips: ['Soothing'] }, { tile: 'none' });
// → inspect/transform, or feed to satori() yourself
```

## Notes

- **Fonts must be `.ttf`/`.otf`/`.woff`** — Satori does not support woff2. Load them once at module scope; the renderer doesn't cache for you.
- **Artwork is inlined.** Satori can't read from disk, so a path won't work — pass a URL, a `data:` URI, or the raw bytes (which get base64-inlined). Read the file in your route.
- Colours are solid hex (the accent also seeds the two corner radial-gradient glows). Pass your theme tokens so the card matches your site.

## License

MIT
