# Changelog

All notable changes to `@arraypress/og-image` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] — Unreleased

### Added

- **Fonts are optional.** Inter (Latin subset, 400/600/700, woff, about 90 KB)
  now ships in `fonts/` and is used when `fonts` is left out. The template has
  always asked for the family `Inter`, so every caller was loading the same
  three files from `@fontsource/inter`; now none has to. It is read once per
  process. The SIL Open Font License is included as `fonts/OFL.txt`.
- **`backdrop`: soft colour glows and a film grain behind the content.** Each
  glow is a colour, a centre and a radius, fading along an eased curve to its
  own colour at nothing, so a card can carry a site's light instead of a flat
  fill. `grain` is seeded noise, so the same card always renders the same
  bytes. Glows replace the template's two faint accent glows.
- **`stripe: false`** leaves off the accent stripe along the top.
- **`fontFamily` and `displayFontFamily`.** The template asked for `Inter`
  by name, so a site's own typeface had to be passed off as Inter, and the
  headline couldn't differ from the text. Now the text uses `fontFamily`
  (default `Inter`) and the title and wordmark use `displayFontFamily`
  (default `fontFamily`).

### Changed

- **A logo is drawn at its own proportions.** Its width follows an SVG's
  `viewBox` (or `width` and `height`) or a PNG's header, at the badge's 40px
  height; a wide mark was shrunk to fit a square. A logo whose shape can't be
  read stays square.
- The image helpers and the backdrop live in their own modules
  (`src/image.js`, `src/backdrop.js`); the package's exports are unchanged.
- `logo` bytes are sniffed like `artwork`, so the bytes of an SVG, JPEG or GIF
  are inlined with the right type. They were always labelled PNG, which meant
  a site rasterising its own `logo.svg` through sharp just to put it on the
  card. A `readFileSync('public/logo.svg')` now works as it is.
- The `exports` entry gains a `default` condition, so the package can be
  loaded with Node's `require` (which loads ES modules from Node 22.12).
  `@arraypress/seo-astro` loads it that way from inside an Astro
  integration, where a dynamic `import()` would go through Vite.
- The README points Astro sites at `@arraypress/seo-astro`, whose `seo()`
  integration renders a card per page with this package.

## [1.2.1] — 2026-09-06

### Changed

- Raised the `satori` dependency floor to `^0.33.4` (was `^0.26.0`). The
  Astro theme family declares `satori` directly for its own icon renderer;
  with the old floor npm/pnpm resolved a second, separate copy for this
  package, so every install shipped two satori versions and OG cards
  rendered on a different engine than PWA icons. Overlapping ranges now
  dedupe to one copy.

  No API change. Verified against the full suite on both versions (20/20
  pass on 0.26.0 and on 0.33.4) and by rendering a reference card on each:
  identical dimensions, line breaks, chip and tile geometry — the only
  delta is glyph-edge rasterisation and sub-pixel letter advances.

## [1.2.0] — 2026-08-01

### Added

- `logo` option for the footer badge — takes PNG bytes or a `data:` /
  `https:` URL. Bytes are base64-encoded internally, so callers can pass
  a `readFileSync` result without doing the MIME dance themselves. When a
  logo is supplied the accent fill drops to transparent, so the square
  frames the mark rather than being replaced by it.

  Previously the badge always rendered `wordmarkInitial` — the first
  letter of the wordmark — so every card shipped with a single letter in
  an accent square. That path is untouched and remains the default, so
  this is purely additive.

## [1.1.0] — 2026-06-26

### Added

- `chips` — up to `maxChips` (default 3) keyword pills rendered under the
  subtitle; blank entries are dropped.
- `tile` visibility mode (`'auto' | 'artwork' | 'none'`) — control the
  right-hand tile: always show it (artwork or initials), show it only when
  artwork is present, or never (text runs full-width). Defaults to
  `'auto'`, preserving prior behaviour.

### Changed

- Split the renderer into a pure, synchronous `buildCard(input, options)`
  that returns the Satori element tree — no fonts, no rasterising — and is
  now the unit-testable surface. `renderOgImage` feeds it to Satori + resvg.

## [1.0.0] — 2026-06-21

### Added

- `renderOgImage(input, options)` — build-time Open Graph card renderer
  (Satori → resvg). One 1200×630 template: eyebrow + title + subtitle
  on the left, an artwork tile (or initials) on the right, a wordmark +
  domain footer. Decoupled from any site config — brand surfaces
  (`colors`, `wordmark`, `domain`, `initials`) and the `fonts` are
  passed in. `artwork` accepts an http(s) URL, a `data:` URI, or raw
  image bytes (MIME sniffed from the magic bytes and base64-inlined).
  Extracted from the duplicated `og-image.ts` shared across the
  ArrayPress Astro theme family.
