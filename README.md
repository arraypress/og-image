# @arraypress/og-image

Build-time Open Graph image renderer — one [Satori](https://github.com/vercel/satori) (HTML/JSX-like tree → SVG) + [@resvg/resvg-js](https://github.com/yisibl/resvg-js) (SVG → PNG) template that fits products, posts, news, or anything else.

Eyebrow + title + subtitle on the left, an artwork tile (or initials) on the right, a wordmark/domain footer. Brand surfaces and fonts are passed in, so it has **no dependency on any site config** — your route resolves those and hands them over. Pure build-time: no adapter, no runtime JS.

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
| `artwork` | `string \| Uint8Array \| Buffer ?` | Right tile: an http(s) URL, a `data:` URI, or raw image bytes (MIME is sniffed). Falls back to `initials`. |

### `options`

| Field | Type | Default |
|---|---|---|
| `fonts` | `OgFont[]` | **Required** — Satori needs ≥1 font. Use `.ttf`/`.otf`/`.woff` (**not** woff2). |
| `colors` | `OgColors?` | merged over defaults (`bg`, `cardBg`, `accent`, `text`, `textSoft`, `muted`, `border`) |
| `wordmark` | `string?` | `''` — footer text + source for default initials |
| `domain` | `string?` | — footer-right text |
| `initials` | `string?` | first 3 letters of `wordmark` |
| `wordmarkInitial` | `string?` | first letter of `wordmark` |
| `titleMaxLength` | `number?` | `80` |
| `subtitleMaxLength` | `number?` | `140` |
| `width` / `height` | `number?` | `1200` / `630` |

## Notes

- **Fonts must be `.ttf`/`.otf`/`.woff`** — Satori does not support woff2. Load them once at module scope; the renderer doesn't cache for you.
- **Artwork is inlined.** Satori can't read from disk, so a path won't work — pass a URL, a `data:` URI, or the raw bytes (which get base64-inlined). Read the file in your route.
- Colours are solid hex (the accent also seeds the two corner radial-gradient glows). Pass your theme tokens so the card matches your site.

## License

MIT
