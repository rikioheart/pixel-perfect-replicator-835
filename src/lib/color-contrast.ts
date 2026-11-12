/**
 * Outils de couleur pour contrôler le thème : conversion OKLCH → sRGB, contraste WCAG,
 * et détection des teintes exclues de la charte (rose, rose poudré, mauve, magenta, fuchsia).
 */
export type Oklch = { l: number; c: number; h: number; alpha: number };

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/;

export function parseOklch(value: string): Oklch | null {
  const m = value.trim().match(OKLCH);
  if (!m) return null;
  const l = Number(m[1]) / (m[2] ? 100 : 1);
  const alpha = m[5] === undefined ? 1 : Number(m[5]) / (m[6] ? 100 : 1);
  return { l, c: Number(m[3]), h: Number(m[4]), alpha };
}

/** sRGB (0–1, borné) d'une couleur OKLCH opaque. */
export function oklchToSrgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return lin.map((x) => {
    const v = Math.min(1, Math.max(0, x));
    return v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v;
  }) as [number, number, number];
}

export function relativeLuminance(rgb: [number, number, number]): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** Rapport de contraste WCAG entre deux couleurs OKLCH opaques. */
export function contrastRatio(a: string, b: string): number {
  const ca = parseOklch(a);
  const cb = parseOklch(b);
  if (!ca || !cb) throw new Error(`Couleur illisible : ${!ca ? a : b}`);
  const la = relativeLuminance(oklchToSrgb(ca));
  const lb = relativeLuminance(oklchToSrgb(cb));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Vrai pour une teinte exclue : mauve/magenta/fuchsia (teinte 280–345) dès qu'elle est colorée,
 * rose ou saumon (teinte 345–40) quand elle est claire. Le bordeaux profond reste permis.
 */
export function isExcludedHue({ l, c, h }: Oklch): boolean {
  if (c <= 0.015) return false;
  if (h >= 280 && h < 345) return c > 0.03;
  const reddish = h >= 345 || h < 40;
  if (!reddish) return false;
  if (l > 0.85) return true; // rose poudré / rosé pâle
  return l > 0.6 && c > 0.05; // rose, saumon
}
