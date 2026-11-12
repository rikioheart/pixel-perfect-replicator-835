/**
 * Lecture des jetons de couleur de src/styles.css pour les tests de contraste (Node uniquement).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contrastOfRgb, srgbOf, type Rgb } from "./color-contrast";

export const themeCss = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

export function cssBlock(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = themeCss.match(new RegExp(`^${escaped} \\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`Bloc introuvable : ${selector}`);
  const vars: Record<string, string> = {};
  for (const [, name, value] of (match[1] ?? "").matchAll(/--([\w-]+):\s*([^;]+);/g)) if (name && value) vars[name] = value.trim();
  return vars;
}

export type Combo = { name: string; selectors: string[]; dark: boolean; highContrast: boolean };

export const COMBOS: Combo[] = [
  { name: "Bordeaux clair", selectors: [":root"], dark: false, highContrast: false },
  { name: "Bordeaux sombre", selectors: [":root", ".dark"], dark: true, highContrast: false },
  { name: "Bleu nuit clair", selectors: [":root", ".sig-bleu-nuit:not(.dark)"], dark: false, highContrast: false },
  { name: "Bleu nuit sombre", selectors: [":root", ".dark", ".sig-bleu-nuit.dark"], dark: true, highContrast: false },
];

export const WITH_CONTRAST: Combo[] = COMBOS.flatMap((combo) => {
  const hc = [".prefs-high-contrast"];
  if (combo.dark) hc.push(".dark.prefs-high-contrast");
  if (combo.selectors.includes(".sig-bleu-nuit:not(.dark)")) hc.push(".sig-bleu-nuit.prefs-high-contrast:not(.dark)");
  if (combo.selectors.includes(".sig-bleu-nuit.dark")) hc.push(".sig-bleu-nuit.dark.prefs-high-contrast");
  return [combo, { ...combo, name: `${combo.name} + contraste renforcé`, selectors: [...combo.selectors, ...hc], highContrast: true }];
});

export function tokens(combo: Combo) {
  const vars = Object.assign({}, ...combo.selectors.map(cssBlock)) as Record<string, string>;
  const get = (name: string, depth = 0): string => {
    const value = vars[name];
    if (value === undefined) throw new Error(`${combo.name} : --${name} absent`);
    const ref = value.match(/^var\(--([\w-]+)\)$/);
    if (ref?.[1] && depth < 10) return get(ref[1], depth + 1);
    return value;
  };
  return { vars, get };
}

/** Une surface : un jeton, ou un jeton posé avec une opacité sur une autre surface (ex. bg-primary/10 sur une carte). */
export type Surface = string | { token: string; alpha: number; over: Surface };

export function surfaceRgb(get: (name: string) => string, surface: Surface, backdrop?: Rgb): Rgb {
  if (typeof surface === "string") return srgbOf(get(surface), backdrop);
  const under = surfaceRgb(get, surface.over, backdrop);
  const top = srgbOf(get(surface.token), under);
  return top.map((v, i) => v * surface.alpha + (under[i] ?? 0) * (1 - surface.alpha)) as Rgb;
}

export function ratio(get: (name: string) => string, fg: Surface, bg: Surface): number {
  const back = surfaceRgb(get, bg);
  return contrastOfRgb(surfaceRgb(get, fg, back), back);
}
