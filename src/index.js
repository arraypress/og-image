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
 * are passed in, so it has no dependency on any site config — the caller
 * resolves those from its own config and hands them over. Fonts are optional:
 * Inter (Latin, 400/600/700) ships with the package and is used when none are
 * given.
 *
 * In an Astro site, use @arraypress/seo-astro, which renders one card per page
 * at build and wires it into the page's meta.
 *
 * @module @arraypress/og-image
 */

import { readFile } from 'node:fs/promises';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { backdropImage } from './backdrop.js';
import { imageRatio, resolveImage } from './image.js';

// ── Design constants ────────────────────────

/* Pinned to the OG spec + visual layout — not worth surfacing as options
 * (no consumer would meaningfully customise these without re-doing the
 * whole template). Card dimensions are overridable via options. */
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;
const ARTWORK_TILE_SIZE = 340;
const STRIPE_HEIGHT = 8;
const PADDING = 72;
const LOGO_HEIGHT = 40;

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

/* The bundled Inter faces, read on first use and kept for the process. */
const BUNDLED_WEIGHTS = [400, 600, 700];
let bundledFonts;

/**
 * The fonts used when the caller passes none: Inter, Latin subset, at the three
 * weights the template uses. Read once and cached, so a build rendering a card
 * per page reads the files once.
 *
 * @returns {Promise<Array<{name: string, data: Buffer, weight: number, style: string}>>} Satori fonts.
 */
function defaultFonts() {
  bundledFonts ??= Promise.all(
    BUNDLED_WEIGHTS.map(async (weight) => ({
      name: 'Inter',
      data: await readFile(new URL(`../fonts/inter-latin-${weight}.woff`, import.meta.url)),
      weight,
      style: 'normal',
    })),
  );
  return bundledFonts;
}

/**
 * Truncate to a maximum length with an ellipsis. Satori handles overflow, but
 * cutting here keeps titles to roughly two visual lines.
 *
 * @param {string|undefined} str - The text.
 * @param {number} max - The longest it may be, ellipsis included.
 * @returns {string|undefined} The text, shortened if it was too long.
 */
function clamp(str, max) {
  if (!str) return str;
  return str.length > max ? str.slice(0, max - 2) + '…' : str;
}

/**
 * Whether the right-hand tile renders: `'auto'` always (artwork, else
 * initials), `'artwork'` only when there is artwork, `'none'` never.
 *
 * @param {'auto'|'artwork'|'none'} mode - The `tile` option.
 * @param {boolean} hasArtwork - Whether the card has artwork.
 * @returns {boolean} True when the tile is drawn.
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
 * @param {OgImageInput} [input={}] - The card content.
 * @param {OgImageOptions} [options={}] - Brand and layout options. Fonts aren't needed.
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
  // `logo` replaces the initial-letter badge with a real mark: a URL, a data:
  // URI, or the bytes of a PNG, JPEG or SVG, sniffed like artwork so a
  // readFileSync result of the site's own logo.svg works as it is.
  // Drawn at its own proportions when they can be read (an SVG's viewBox, a
  // PNG's header), so a wide mark isn't shrunk into a square.
  const logoSrc = resolveImage(options.logo) ?? null;
  const logoWidth = Math.round(LOGO_HEIGHT * (imageRatio(options.logo) ?? 1));
  const fontFamily = options.fontFamily ?? 'Inter';
  const displayFontFamily = options.displayFontFamily ?? fontFamily;

  const title = clamp(input.title ?? '', options.titleMaxLength ?? DEFAULT_TITLE_MAX);
  const subtitle = clamp(input.subtitle, options.subtitleMaxLength ?? DEFAULT_SUBTITLE_MAX);
  const chips = (Array.isArray(input.chips) ? input.chips : [])
    .filter((c) => typeof c === 'string' && c.trim() !== '')
    .slice(0, options.maxChips ?? DEFAULT_MAX_CHIPS);

  const artworkSrc = resolveImage(input.artwork);
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
              fontFamily: displayFontFamily,
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

  // The template's own glows are two faint accent washes in opposite corners;
  // a `backdrop` with glows of its own replaces them.
  const background = backdropImage(options.backdrop, {
    width,
    height,
    fallbackGlows: `radial-gradient(circle at 0% 0%, ${colors.accent}10 0%, transparent 50%), radial-gradient(circle at 100% 100%, ${colors.accent}08 0%, transparent 40%)`,
  });

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: colors.bg,
        ...(background && { backgroundImage: background }),
        fontFamily,
        color: colors.text,
        position: 'relative',
      },
      children: [
        // Top accent stripe — brand band tying the card to the site header.
        options.stripe !== false && {
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
                          width: `${logoSrc ? logoWidth : LOGO_HEIGHT}px`,
                          height: `${LOGO_HEIGHT}px`,
                          borderRadius: '8px',
                          backgroundColor: logoSrc ? 'transparent' : colors.accent,
                          color: colors.bg,
                          fontSize: '22px',
                          fontWeight: 700,
                        },
                        children: logoSrc
                          ? [
                              {
                                type: 'img',
                                props: { src: logoSrc, width: logoWidth, height: LOGO_HEIGHT, style: { borderRadius: '8px' } },
                              },
                            ]
                          : wordmarkInitial,
                      },
                    },
                    wordmark && {
                      type: 'div',
                      props: {
                        style: { display: 'flex', fontFamily: displayFontFamily, fontSize: '24px', fontWeight: 600, color: colors.text },
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
      ].filter(Boolean),
    },
  };
}

// ── Renderer ────────────────────────────────

/**
 * Render an Open Graph card to a PNG.
 *
 * @param {OgImageInput} input - The card content.
 * @param {OgImageOptions} [options={}] - Brand and layout options, plus fonts.
 *   Without `fonts`, the bundled Inter is used.
 * @returns {Promise<Uint8Array>} PNG bytes — hand straight to a Response or a file.
 * @throws {Error} When `input.title` is missing, or `fonts` is given but empty.
 *
 * @example
 * import { renderOgImage } from '@arraypress/og-image';
 *
 * const png = await renderOgImage(
 *   { title: 'The Healer', subtitle: 'A lightworker archetype', chips: ['Compassionate', 'Soothing', 'Nurturing'] },
 *   { wordmark: 'Personality Tests', tile: 'artwork', colors: { accent: '#d1fe17' } },
 * );
 */
export async function renderOgImage(input, options = {}) {
  if (!input || !input.title) throw new Error('renderOgImage: `input.title` is required.');
  if (options.fonts !== undefined && (!Array.isArray(options.fonts) || options.fonts.length === 0)) {
    throw new Error('renderOgImage: `options.fonts` must contain at least one font, or be left out for the bundled Inter.');
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const fonts = options.fonts ?? (await defaultFonts());

  const svg = await satori(buildCard(input, options), { width, height, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}
