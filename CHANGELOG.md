# Changelog

All notable changes to `@arraypress/og-image` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1]

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

## [1.0.0] — Unreleased

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
