# Changelog

All notable changes to `@arraypress/og-image` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
