/**
 * @arraypress/og-image
 *
 * Build-time Open Graph image renderer — Satori (HTML/JSX-like tree → SVG)
 * + @resvg/resvg-js (SVG → PNG). One 1200×630 template fits products, posts,
 * news, or any content: an eyebrow + title + subtitle (+ optional keyword
 * chips) on the left, an optional artwork tile (or initials) on the right, and
 * a wordmark/domain footer.
 *
 * Framework- and config-agnostic. Brand surfaces (colours, wordmark, initials)
 * and the fonts are passed in, so it has no dependency on any site config —
 * the calling route resolves those from its own config and hands them over.
 *
 * @module @arraypress/og-image
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

// ── Design constants ────────────────────────

/* Pinned to the OG spec + visual layout — not worth surfacing as options
 * (no consumer would meaningfully customise these without re-doing the
 * whole template). Card dimensions are overridable via options. */
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;
const ARTWORK_TILE_SIZE = 340;
const STRIPE_HEIGHT = 8;
const PADDING = 72;

const DEFAULT_TITLE_MAX = 80;
const DEFAULT_SUBTITLE_MAX = 140;
const DEFAULT_MAX_CHIPS = 3;

/* Brand colours — overridable per-render via `options.colors`. Defaults are
 * a neutral dark card; pass your own to mirror your theme tokens (Satori runs
 * in Node and can't read CSSOM, so the palette has to be handed in). */
const DEFAULT_COLORS = {
  bg: '#0a0a0a',
  cardBg: '#141414',
  accent: '#00FFC2',
  text: '#ededed',
  textSoft: '#c8c8c8',
  muted: '#7a7a7e',
  border: '#242424',
};

// ── Helpers ─────────────────────────────────

/* Sniff an image MIME type from the leading magic bytes, so a raw artwork
 * buffer can be inlined as a data URI (Satori can't read from disk — images
 * must be inlined or remote URLs). Falls back to PNG. */
function sniffMime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'image/webp';
  if (bytes[0] === 0x3c) return 'image/svg+xml';
  return 'image/png';
}

/* Resolve the `artwork` option to something Satori's <img src> accepts:
 * an http(s) URL or `data:` URI passes through untouched; raw bytes get
 * sniffed + base64-encoded into a data URI. Returns undefined when absent. */
function resolveArtwork(artwork) {
  if (!artwork) return undefined;
  if (typeof artwork === 'string') return artwork;
  const bytes = artwork instanceof Uint8Array ? artwork : new Uint8Array(artwork);
  return `data:${sniffMime(bytes)};base64,${Buffer.from(bytes).toString('base64')}`;
}

/* Truncate to a max length at a character boundary with an ellipsis. Satori
 * handles overflow, but we'd rather control where the cut happens so titles
 * stay roughly two visual lines. */
function clamp(str, max) {
  if (!str) return str;
  return str.length > max ? str.slice(0, max - 2) + '…' : str;
}

/* Whether the right-hand tile should render, given the `tile` mode + artwork:
 *   'auto'    → always (artwork, else initials)   [default, back-compatible]
 *   'artwork' → only when there's artwork (else the text runs full-width)
 *   'none'    → never (text always full-width)
 */
function tileVisible(mode, hasArtwork) {
  if (mode === 'none') return false;
  if (mode === 'artwork') return hasArtwork;
  return true; // 'auto'
}

// ── Tree builder (pure — no fonts, no I/O) ───

/**
 * Build the Satori element tree for a card. Pure and synchronous — it needs no
 * fonts and does no rendering, so it's the unit-testable surface (Satori
 * rasterises text to paths, so the rendered PNG/SVG can't be asserted on for
 * content). {@link renderOgImage} feeds this tree to Satori + resvg.
 *
 * @param {OgImageInput} input
 * @param {OgImageOptions} [options]
 * @returns {object} A Satori-compatible element tree.
 */
export function buildCard(input = {}, options = {}) {
  const colors = { ...DEFAULT_COLORS, ...(options.colors ?? {}) };
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const wordmark = options.wordmark ?? '';
  const domain = options.domain ?? '';
  const initials = options.initials ?? (wordmark.slice(0, 3).toUpperCase() || 'OG');
  const wordmarkInitial = options.wordmarkInitial ?? (wordmark.charAt(0).toUpperCase() || 'O');

  const title = clamp(input.title ?? '', options.titleMaxLength ?? DEFAULT_TITLE_MAX);
  const subtitle = clamp(input.subtitle, options.subtitleMaxLength ?? DEFAULT_SUBTITLE_MAX);
  const chips = (Array.isArray(input.chips) ? input.chips : [])
    .filter((c) => typeof c === 'string' && c.trim() !== '')
    .slice(0, options.maxChips ?? DEFAULT_MAX_CHIPS);

  const artworkSrc = resolveArtwork(input.artwork);
  const showTile = tileVisible(options.tile ?? 'auto', !!artworkSrc);

  const leftColumn = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', flex: 1, gap: '20px', minWidth: 0 },
      children: [
        input.eyebrow && {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: '22px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: colors.accent,
            },
            children: input.eyebrow,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: title.length > 50 ? '56px' : '68px',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: colors.text,
            },
            children: title,
          },
        },
        subtitle && {
          type: 'div',
          props: {
            style: { display: 'flex', fontSize: '26px', lineHeight: 1.35, color: colors.textSoft, fontWeight: 400 },
            children: subtitle,
          },
        },
        // Keyword chips — small rounded pills under the subtitle.
        chips.length > 0 && {
          type: 'div',
          props: {
            style: { display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' },
            children: chips.map((c) => ({
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: colors.accent,
                  border: `2px solid ${colors.border}`,
                  borderRadius: '999px',
                  padding: '6px 18px',
                },
                children: c,
              },
            })),
          },
        },
      ].filter(Boolean),
    },
  };

  const tile = showTile && {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${ARTWORK_TILE_SIZE}px`,
        height: `${ARTWORK_TILE_SIZE}px`,
        flexShrink: 0,
        borderRadius: '24px',
        backgroundColor: colors.cardBg,
        border: `2px solid ${colors.border}`,
        overflow: 'hidden',
      },
      children: artworkSrc
        ? {
          type: 'img',
          props: {
            src: artworkSrc,
            width: ARTWORK_TILE_SIZE,
            height: ARTWORK_TILE_SIZE,
            style: { objectFit: 'cover', width: '100%', height: '100%' },
          },
        }
        : {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              fontSize: '160px',
              fontWeight: 700,
              color: colors.accent,
              letterSpacing: '-0.04em',
            },
            children: initials,
          },
        },
    },
  };

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: colors.bg,
        backgroundImage: `radial-gradient(circle at 0% 0%, ${colors.accent}10 0%, transparent 50%), radial-gradient(circle at 100% 100%, ${colors.accent}08 0%, transparent 40%)`,
        fontFamily: 'Inter',
        color: colors.text,
        position: 'relative',
      },
      children: [
        // Top accent stripe — brand band tying the card to the site header.
        {
          type: 'div',
          props: {
            style: { display: 'flex', height: `${STRIPE_HEIGHT}px`, width: '100%', backgroundColor: colors.accent },
          },
        },

        // Body — text left, optional art tile right.
        {
          type: 'div',
          props: {
            style: { display: 'flex', flex: 1, padding: `${PADDING}px`, gap: '56px', alignItems: 'center' },
            children: [leftColumn, tile].filter(Boolean),
          },
        },

        // Footer — wordmark badge + text left, domain right.
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${PADDING}px 48px ${PADDING}px`,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: '16px' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          backgroundColor: colors.accent,
                          color: colors.bg,
                          fontSize: '22px',
                          fontWeight: 700,
                        },
                        children: wordmarkInitial,
                      },
                    },
                    wordmark && {
                      type: 'div',
                      props: {
                        style: { display: 'flex', fontSize: '24px', fontWeight: 600, color: colors.text },
                        children: wordmark,
                      },
                    },
                  ].filter(Boolean),
                },
              },
              domain && {
                type: 'div',
                props: {
                  style: { display: 'flex', fontSize: '20px', color: colors.muted, fontWeight: 400 },
                  children: domain,
                },
              },
            ].filter(Boolean),
          },
        },
      ],
    },
  };
}

// ── Renderer ────────────────────────────────

/**
 * Render an Open Graph card to a PNG.
 *
 * @param {OgImageInput} input - The card content.
 * @param {OgImageOptions} options - Fonts (required) + brand/layout options.
 * @returns {Promise<Uint8Array>} PNG bytes — hand straight to a Response.
 *
 * @example
 * import { renderOgImage } from '@arraypress/og-image';
 * import { readFile } from 'node:fs/promises';
 *
 * const fonts = [{ name: 'Inter', data: await readFile('Inter-Regular.ttf'), weight: 400, style: 'normal' }];
 * const png = await renderOgImage(
 *   { title: 'The Healer', subtitle: 'A lightworker archetype', chips: ['Compassionate', 'Soothing', 'Nurturing'] },
 *   { fonts, wordmark: 'Personality Tests', tile: 'artwork', colors: { accent: '#d1fe17' } },
 * );
 */
export async function renderOgImage(input, options) {
  if (!input || !input.title) throw new Error('renderOgImage: `input.title` is required.');
  if (!options || !Array.isArray(options.fonts) || options.fonts.length === 0) {
    throw new Error('renderOgImage: `options.fonts` must contain at least one font (Satori needs a font to render text).');
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;

  const svg = await satori(buildCard(input, options), { width, height, fonts: options.fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}
