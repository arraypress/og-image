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
  /** Right-tile image: an http(s) URL, a `data:` URI, or raw image bytes
   *  (MIME sniffed). When absent, `initials` are shown instead. */
  artwork?: string | Uint8Array | Buffer;
}

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
  /** Title truncation threshold. Default: 80 */
  titleMaxLength?: number;
  /** Subtitle truncation threshold. Default: 140 */
  subtitleMaxLength?: number;
  /** Card width in px. Default: 1200 */
  width?: number;
  /** Card height in px. Default: 630 */
  height?: number;
}

/**
 * Render an Open Graph card to a PNG (1200×630 by default).
 *
 * @example
 * const png = await renderOgImage(
 *   { title: 'Lush Pads Vol. 2', eyebrow: 'Sample pack' },
 *   { fonts, wordmark: 'WaveGrid', domain: 'wavegrid.app' },
 * );
 */
export function renderOgImage(input: OgImageInput, options: OgImageOptions): Promise<Uint8Array>;
