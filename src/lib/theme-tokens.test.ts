import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, isExcludedHue, parseOklch } from "./color-contrast";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

function block(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`^${escaped} \\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`Bloc introuvable : ${selector}`);
  const vars: Record<string, string> = {};
  for (const [, name, value] of match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[name] = value.trim();
  return vars;
}

type Combo = { name: string; selectors: string[] };
const COMBOS: Combo[] = [
  { name: "Bordeaux clair", selectors: [":root"] },
  { name: "Bordeaux sombre", selectors: [":root", ".dark"] },
  { name: "Bleu nuit clair", selectors: [":root", ".sig-bleu-nuit:not(.dark)"] },
  { name: "Bleu nuit sombre", selectors: [":root", ".dark", ".sig-bleu-nuit.dark"] },
];
const WITH_CONTRAST: Combo[] = COMBOS.flatMap((combo) => [
  combo,
  {
    name: `${combo.name} + contraste renforcé`,
    selectors: [
      ...combo.selectors,
      ".prefs-high-contrast",
      ...(combo.selectors.includes(".dark") ? [".dark.prefs-high-contrast"] : []),
    ],
  },
]);

function tokens(combo: Combo) {
  const vars = Object.assign({}, ...combo.selectors.map(block)) as Record<string, string>;
  const get = (name: string, depth = 0): string => {
    const value = vars[name];
    if (value === undefined) throw new Error(`${combo.name} : --${name} absent`);
    const ref = value.match(/^var\(--([\w-]+)\)$/);
    if (ref && depth < 10) return get(ref[1], depth + 1);
    return value;
  };
  return { vars, get };
}

// [texte, fond, minimum] — 4,5:1 pour le texte (AA), 3:1 pour l'anneau de focus.
const PAIRS: [string, string, number][] = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary-ink", "background", 4.5],
  ["primary-ink", "card", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["muted-foreground", "card", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  ["success-foreground", "success", 4.5],
  ["warning-foreground", "warning", 4.5],
  ["navy-foreground", "navy", 4.5],
  ["wine-foreground", "wine", 4.5],
  ["sidebar-foreground", "sidebar", 4.5],
  ["sidebar-primary-foreground", "sidebar-primary", 4.5],
  ["signature-foreground", "signature-from", 4.5],
  ["signature-foreground", "signature-to", 4.5],
  ["sand-foreground", "sand", 4.5],
  ["gold-foreground", "gold", 4.5],
  ["gold-ink", "background", 4.5],
  ["gold-ink", "card", 4.5],
  ["ring", "background", 3],
];

describe("Thème : contrastes WCAG AA", () => {
  for (const combo of WITH_CONTRAST) {
    it(`${combo.name} : chaque texte atteint son contraste minimal`, () => {
      const { get } = tokens(combo);
      const failures = PAIRS.flatMap(([fg, bg, min]) => {
        const ratio = contrastRatio(get(fg), get(bg));
        return ratio < min ? [`--${fg} sur --${bg} : ${ratio.toFixed(2)} < ${min}`] : [];
      });
      expect(failures).toEqual([]);
    });
  }
});

// Couleurs sémantiques (erreur, succès, avertissement) et graphiques : hors charte de marque.
const SEMANTIC = /^(destructive|success|warning|chart-\d)(-|$)/;

describe("Thème : aucune teinte rose, mauve, magenta ou fuchsia", () => {
  for (const combo of COMBOS) {
    it(`${combo.name} : couleurs de marque conformes`, () => {
      const { vars, get } = tokens(combo);
      const offenders = Object.keys(vars).flatMap((name) => {
        if (SEMANTIC.test(name)) return [];
        const color = parseOklch(get(name));
        return color && isExcludedHue(color) ? [`--${name} ${get(name)}`] : [];
      });
      expect(offenders).toEqual([]);
    });
  }

  it("rejette bien l'ancien fond rosé et l'ancien bordeaux éclairci", () => {
    expect(isExcludedHue(parseOklch("oklch(0.93 0.025 30)")!)).toBe(true);
    expect(isExcludedHue(parseOklch("oklch(0.72 0.12 12)")!)).toBe(true);
    expect(isExcludedHue(parseOklch("oklch(0.7 0.08 300)")!)).toBe(true);
    expect(isExcludedHue(parseOklch("oklch(0.395 0.128 12)")!)).toBe(false);
  });
});

describe("Thème : signatures distinctes", () => {
  it("Bordeaux et Bleu nuit ont chacun leur couleur principale, en clair comme en sombre", () => {
    const [bordeauxLight, bordeauxDark, nuitLight, nuitDark] = COMBOS.map((combo) => tokens(combo).get("primary"));
    expect(bordeauxLight).not.toBe(nuitLight);
    expect(bordeauxDark).not.toBe(nuitDark);
  });
});
