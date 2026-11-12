import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DogEmptyArt, type DogArt } from "@/components/DogEmptyArt";
import { contrastRatio } from "./color-contrast";
import { WITH_CONTRAST, themeCss, tokens } from "./theme-css.test-helpers";

const ARTS: DogArt[] = ["attentive", "resting", "playful"];
const source = readFileSync(resolve(process.cwd(), "src/components/DogEmptyArt.tsx"), "utf8");
const artRules = themeCss.split("\n").filter((line) => line.startsWith(".dog-art") || /--art-/.test(line)).join("\n");

type SvgProps = { dangerouslySetInnerHTML: { __html: string }; "aria-hidden"?: boolean; role?: string; "aria-label"?: string; "data-decorative"?: boolean };
const render = (art: DogArt, label?: string) => (DogEmptyArt({ art, label }) as unknown as { props: SvgProps }).props;

describe("DogEmptyArt", () => {
  it("reste léger : moins de 10 Ko ajoutés (dessins + couleurs)", () => {
    expect(Buffer.byteLength(source) + Buffer.byteLength(artRules)).toBeLessThan(10 * 1024);
  });

  it("trois scènes distinctes, sans image distante ni animation", () => {
    const scenes = ARTS.map((art) => render(art).dangerouslySetInnerHTML.__html);
    expect(new Set(scenes).size).toBe(3);
    for (const svg of scenes) {
      expect(svg).not.toMatch(/https?:|<image|<animate|<script|style=/i);
    }
  });

  it("décoratif par défaut : masqué aux lecteurs d'écran", () => {
    const props = render("resting");
    expect(props["aria-hidden"]).toBe(true);
    expect(props["data-decorative"]).toBe(true);
    expect(props.role).toBeUndefined();
  });

  it("informatif quand une description est donnée", () => {
    const props = render("playful", "Un chien qui joue avec une balle");
    expect(props.role).toBe("img");
    expect(props["aria-label"]).toBe("Un chien qui joue avec une balle");
    expect(props["aria-hidden"]).toBeUndefined();
  });

  for (const combo of WITH_CONTRAST) {
    it(`${combo.name} : yeux, truffe et collier lisibles sur le pelage, silhouette visible sur la carte`, () => {
      const { get } = tokens(combo);
      expect(contrastRatio(get("art-ink"), get("art-coat"))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(get("art-collar"), get("art-coat"))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(get("art-coat"), get("card"))).toBeGreaterThanOrEqual(1.4);
    });
  }
});
