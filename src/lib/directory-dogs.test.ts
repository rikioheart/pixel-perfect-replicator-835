import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dogSourcesFor } from "./directory-dogs";

describe("annuaire — confidentialité canine", () => {
  it("un particulier ne voit que son foyer", () => {
    expect(dogSourcesFor({ isBureau: false, isPro: false })).toEqual(["household"]);
  });

  it("un professionnel passe par get_pro_dogs, jamais par le registre Bureau", () => {
    expect(dogSourcesFor({ isBureau: false, isPro: true })).toEqual(["household", "pro"]);
  });

  it("le Bureau passe par bureau_dogs", () => {
    expect(dogSourcesFor({ isBureau: true, isPro: false })).toEqual(["household", "bureau"]);
  });

  it("l'annuaire ne lit jamais la table des chiens en direct", () => {
    for (const file of ["src/routes/_authenticated/directory.tsx", "src/components/DirectoryDogs.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/from\(\s*["']dogs["']\s*\)/);
    }
  });
});
