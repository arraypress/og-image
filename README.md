# @arraypress/og-image

Build-time Open Graph image renderer — one [Satori](https://github.com/vercel/satori) (HTML/JSX-like tree → SVG) + [@resvg/resvg-js](https://github.com/yisibl/resvg-js) (SVG → PNG) template that fits products, posts, news, or anything else.

Eyebrow + title + subtitle (+ optional keyword chips) on the left, an optional artwork tile (or initials) on the right, a wordmark/domain footer. Brand surfaces are passed in, so it has **no dependency on any site config** — your build resolves those and hands them over. Inter is bundled, so fonts are optional. Pure build-time: no adapter, no runtime JS.

**Using Astro?** You want [`@arraypress/seo-astro`](https://www.npmjs.com/package/@arraypress/seo-astro) instead. Its `seo()` integration calls this package to render one card per page at build and puts it in the page's `og:image`, with no endpoint or script to write. This package is the renderer underneath, for any other build.

## Install

```bash
npm install @arraypress/og-image
```

## Usage

### `renderOgImage(input, options)`

Render a 1200×630 card to PNG bytes.

```js
import { renderOgImage } from '@arraypress/og-image';
import { writeFile } from 'node:fs/promises';

const png = await renderOgImage(
  { title: 'Lush Pads Vol. 2', subtitle: '120 royalty-free samples', eyebrow: 'Sample pack' },
  { wordmark: 'WaveGrid', domain: 'wavegrid.app', colors: { accent: '#d1fe17' } },
);
await writeFile('dist/og/lush-pads.png', png);
```

Pass your own fonts to change the typeface:

```js
const fonts = [
  { name: 'Inter', data: await readFile('Inter-Regular.ttf'), weight: 400, style: 'normal' },
  { name: 'Inter', data: await readFile('Inter-Bold.ttf'),    weight: 700, style: 'normal' },
];
await renderOgImage(input, { fonts, wordmark: 'WaveGrid' });
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
| `fonts` | `OgFont[]?` | the bundled Inter (Latin, 400/600/700). Use `.ttf`/`.otf`/`.woff` (**not** woff2). |
| `colors` | `OgColors?` | merged over defaults (`bg`, `cardBg`, `accent`, `text`, `textSoft`, `muted`, `border`) |
| `wordmark` | `string?` | `''` — footer text + source for default initials |
| `domain` | `string?` | — footer-right text |
| `initials` | `string?` | first 3 letters of `wordmark` |
| `wordmarkInitial` | `string?` | first letter of `wordmark` |
| `logo` | `string \| Uint8Array \| Buffer ?` | — replaces the footer badge's letter: a URL, a `data:` URI, or PNG/JPEG/SVG bytes. 40px tall, as wide as its own proportions make it |
| `backdrop` | `OgBackdrop?` | two faint accent glows — see [Backdrop](#backdrop) |
| `stripe` | `boolean?` | `true` — the accent stripe along the top |
| `fontFamily` | `string?` | `'Inter'` — the family the card's text asks for |
| `displayFontFamily` | `string?` | `fontFamily` — the title's and wordmark's family |
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

### Backdrop

Soft glows of colour and a film grain over `colors.bg`, behind the content, so
the card can carry a site's light rather than a flat fill:

```js
await renderOgImage(
  { title: 'Skip the build. Start selling.' },
  {
    colors: { bg: '#08080a', text: '#ffffff' },
    stripe: false,
    backdrop: {
      grain: true,
      glows: [
        { color: '#0957ff', x: 2, y: 82, size: 52 },
        { color: '#f69d03', x: 100, y: 10, size: 44, opacity: 0.9 },
      ],
    },
  },
);
```

| Glow field | Default | |
|---|---|---|
| `color` | — | hex: `#rgb`, `#rrggbb` or `#rrggbbaa` |
| `x` / `y` | `50` / `50` | the centre, as a percentage of the card's width and height; outside 0–100 sits off the edge |
| `size` | `50` | the radius, as a percentage of the card's width |
| `opacity` | `1` | strength at the centre, on top of the colour's own alpha |

Each glow fades along an eased curve to its own colour at nothing, so there's
no edge and no grey fringe. The first glow paints on top. Glows replace the
template's two faint accent glows; `glows: []` leaves none.

`grain: true` is a light grain; a number from 0 to 1 sets how strong. It's
seeded noise, so the same card renders the same bytes every time, and a build
that caches cards by content keeps working.

**Grain is heavy.** Noise doesn't compress, so a grained card is over 1 MB
where the same card without it is around 300 KB, and some apps skip a preview
image that large. Glows alone are usually the better trade.

### Your own typeface

Name your fonts, and say which family the text and the headline use. The
headline and the wordmark take `displayFontFamily`; everything else takes
`fontFamily`:

```js
const fonts = [
  { name: 'Inter', data: await readFile('inter-latin-400-normal.woff'), weight: 400 },
  { name: 'Inter', data: await readFile('inter-latin-600-normal.woff'), weight: 600 },
  { name: 'Gabarito', data: await readFile('gabarito-latin-600-normal.woff'), weight: 600 },
  { name: 'Gabarito', data: await readFile('gabarito-latin-700-normal.woff'), weight: 700 },
];
await renderOgImage(input, { fonts, displayFontFamily: 'Gabarito' });
```

The template uses 400 and 600 for text, 600 for the wordmark and 700 for the
title. Passing `fonts` replaces the bundled Inter, so include the text face too.

### `buildCard(input, options?)`

The pure, synchronous tree builder behind `renderOgImage` — returns the Satori element tree and needs **no fonts**. Useful for advanced rendering, or for unit tests (Satori rasterises text to glyph paths, so the rendered PNG/SVG can't be asserted on for content; assert on the tree instead).

```js
import { buildCard } from '@arraypress/og-image';

const tree = buildCard({ title: 'The Healer', chips: ['Soothing'] }, { tile: 'none' });
// → inspect/transform, or feed to satori() yourself
```

## Notes

- **Fonts must be `.ttf`/`.otf`/`.woff`** — Satori does not support woff2. Load your own once at module scope; the renderer only caches the bundled Inter. The template asks for `fontFamily` (`Inter` unless you say otherwise), so name your fonts to match or set it.
- **The bundled Inter is Latin only.** Cards in other scripts need fonts that cover them. It is licensed under the SIL Open Font License, included as `fonts/OFL.txt`.
- **Artwork is inlined.** Satori can't read from disk, so a path won't work — pass a URL, a `data:` URI, or the raw bytes (which get base64-inlined). Read the file in your route.
- Colours are solid hex (the accent also seeds the two faint corner glows, unless a `backdrop` brings its own). Pass your theme tokens so the card matches your site.

## Licence

MIT © ArrayPress Limited. The bundled Inter font is © The Inter Project Authors, under the SIL Open Font License 1.1.
