/**
 * @arraypress/og-image — TypeScript definitions.
 */

export interface OgFont {
  /** Font family name. The template asks for `fontFamily` (default 'Inter') and `displayFontFamily`. */
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
  /** Accent — stripe, eyebrow, initials, footer badge, and the faint corner glows. */
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

/** A soft circle of colour behind the card's content. */
export interface OgGlow {
  /** Hex colour: `#rgb`, `#rrggbb`, or with alpha `#rrggbbaa`. */
  color: string;
  /** Centre, across, as a percentage of the card's width. May fall outside 0–100. Default: 50 */
  x?: number;
  /** Centre, down, as a percentage of the card's height. May fall outside 0–100. Default: 50 */
  y?: number;
  /** Radius, as a percentage of the card's width. Default: 50 */
  size?: number;
  /** Strength at the centre, 0–1, on top of the colour's own alpha. Default: 1 */
  opacity?: number;
}

/** What's drawn over `colors.bg`, behind the content. */
export interface OgBackdrop {
  /** Colour glows, fading out from their centres; later ones paint under earlier ones.
   *  When given, they replace the template's faint accent glows (`[]` for none). */
  glows?: OgGlow[];
  /** Film grain over the whole card: `true` for a light grain, or its strength, 0–1. Default: none */
  grain?: boolean | number;
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
  /** Satori font set (at least one). Default: the bundled Inter, Latin, 400/600/700. */
  fonts?: OgFont[];
  /** Palette overrides, merged over the defaults. */
  colors?: OgColors;
  /** Footer brand text + fallback source for the initials. Default: '' */
  wordmark?: string;
  /** Footer-right text (e.g. your bare domain). */
  domain?: string;
  /** Tile glyph when there's no artwork. Default: first 3 letters of `wordmark`. */
  initials?: string;
  /** Real logo for the footer badge, replacing the initial letter. PNG, JPEG
   *  or SVG bytes (the type is sniffed), or a data:/https: URL Satori can load.
   *  Drawn 40px tall; an SVG's or PNG's own proportions set its width, else it's square. */
  logo?: Uint8Array | Buffer | string;
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
  /** Glows and grain behind the content. Default: two faint accent glows, no grain. */
  backdrop?: OgBackdrop;
  /** The accent stripe along the top. Default: `true` */
  stripe?: boolean;
  /** Font family for the card's text, as named in `fonts`. Default: `'Inter'` */
  fontFamily?: string;
  /** Font family for the title and wordmark, as named in `fonts`. Default: `fontFamily` */
  displayFontFamily?: string;
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
export function buildCard(input: OgImageInput, options?: OgImageOptions): OgElement;

/**
 * Render an Open Graph card to a PNG (1200×630 by default). Without `fonts`,
 * the bundled Inter is used.
 *
 * @example
 * const png = await renderOgImage(
 *   { title: 'The Healer', subtitle: 'A lightworker archetype', chips: ['Soothing', 'Nurturing'] },
 *   { wordmark: 'Personality Tests', tile: 'artwork' },
 * );
 */
export function renderOgImage(input: OgImageInput, options?: OgImageOptions): Promise<Uint8Array>;
