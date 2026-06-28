/**
 * @arraypress/og-image — TypeScript definitions.
 */

export interface OgFont {
  /** Font family name, referenced as `fontFamily` in the template (use 'Inter'). */
  name: string;
  /** Raw font bytes (ttf/otf/woff — Satori does NOT support woff2). */
  data: ArrayBuffer | Buffer;
  /** Font weight (400/600/700). Default: 400 */
  weight?: number;
  /** Font style. Default: 'normal' */
  style?: 'normal' | 'italic';
}

export interface OgColors {
  /** Page background. */
  bg?: string;
  /** Artwork-tile background. */
  cardBg?: string;
  /** Accent — stripe, eyebrow, initials, footer badge. */
  accent?: string;
  /** Primary text (title, wordmark). */
  text?: string;
  /** Secondary text (subtitle). */
  textSoft?: string;
  /** Muted text (domain). */
  muted?: string;
  /** Tile border. */
  border?: string;
}

export interface OgImageInput {
  /** Headline (left column). Required. */
  title: string;
  /** Sub-line under the title. */
  subtitle?: string;
  /** Small uppercase accent label above the title. */
  eyebrow?: string;
  /** Short keyword chips rendered as pills under the subtitle. Capped at
   *  `maxChips` (default 3); empty/blank entries are dropped. */
  chips?: string[];
  /** Right-tile image: an http(s) URL, a `data:` URI, or raw image bytes
   *  (MIME sniffed). When absent, `initials` are shown instead (see `tile`). */
  artwork?: string | Uint8Array | Buffer;
}

/**
 * Right-hand tile visibility:
 * - `'auto'` (default) — always show a tile: the artwork, or initials when absent.
 * - `'artwork'` — show the tile only when there's artwork; otherwise the text
 *   runs full-width (no initials placeholder).
 * - `'none'` — never show a tile; the text always runs full-width.
 */
export type OgTileMode = 'auto' | 'artwork' | 'none';

export interface OgImageOptions {
  /** Satori font set (at least one). Required. */
  fonts: OgFont[];
  /** Palette overrides, merged over the defaults. */
  colors?: OgColors;
  /** Footer brand text + fallback source for the initials. Default: '' */
  wordmark?: string;
  /** Footer-right text (e.g. your bare domain). */
  domain?: string;
  /** Tile glyph when there's no artwork. Default: first 3 letters of `wordmark`. */
  initials?: string;
  /** Letter in the footer badge. Default: first letter of `wordmark`. */
  wordmarkInitial?: string;
  /** When/whether to show the right-hand tile. Default: `'auto'`. */
  tile?: OgTileMode;
  /** Max number of keyword chips rendered. Default: 3 */
  maxChips?: number;
  /** Title truncation threshold. Default: 80 */
  titleMaxLength?: number;
  /** Subtitle truncation threshold. Default: 140 */
  subtitleMaxLength?: number;
  /** Card width in px. Default: 1200 */
  width?: number;
  /** Card height in px. Default: 630 */
  height?: number;
}

/** A Satori-compatible element tree (the shape `buildCard` returns). */
export interface OgElement {
  type: string;
  props: Record<string, unknown>;
}

/**
 * Build the Satori element tree for a card. Pure and synchronous — needs no
 * fonts and does no rendering, so it's the unit-testable surface (Satori
 * rasterises text to paths, so the rendered output can't be asserted on for
 * content). `renderOgImage` feeds this tree to Satori + resvg.
 */
export function buildCard(
  input: OgImageInput,
  options?: Omit<OgImageOptions, 'fonts'> & { fonts?: OgFont[] }
): OgElement;

/**
 * Render an Open Graph card to a PNG (1200×630 by default).
 *
 * @example
 * const png = await renderOgImage(
 *   { title: 'The Healer', subtitle: 'A lightworker archetype', chips: ['Soothing', 'Nurturing'] },
 *   { fonts, wordmark: 'Personality Tests', tile: 'artwork' },
 * );
 */
export function renderOgImage(input: OgImageInput, options: OgImageOptions): Promise<Uint8Array>;
