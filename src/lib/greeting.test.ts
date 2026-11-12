import { describe, expect, it } from "vitest";
import { buildGreeting, deName, dogPhrase, localDay, seasonLine, seasonOf } from "./greeting";

const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe("saison calculée localement à partir de la date", () => {
  it("printemps à partir du 20 mars", () => {
    expect(seasonOf(d("2026-03-19"))).toBe("HIVER");
    expect(seasonOf(d("2026-03-20"))).toBe("PRINTEMPS");
  });
  it("été à partir du 21 juin", () => {
    expect(seasonOf(d("2026-06-20"))).toBe("PRINTEMPS");
    expect(seasonOf(d("2026-06-21"))).toBe("ETE");
  });
  it("automne à partir du 23 septembre", () => {
    expect(seasonOf(d("2026-09-22"))).toBe("ETE");
    expect(seasonOf(d("2026-09-23"))).toBe("AUTOMNE");
  });
  it("hiver à partir du 21 décembre et jusqu'en mars", () => {
    expect(seasonOf(d("2026-12-20"))).toBe("AUTOMNE");
    expect(seasonOf(d("2026-12-21"))).toBe("HIVER");
    expect(seasonOf(d("2027-01-15"))).toBe("HIVER");
  });
});

describe("noms des chiens : seulement ceux fournis, jamais inventés", () => {
  it("aucun chien : aucune mention", () => {
    expect(dogPhrase([])).toBeNull();
    expect(dogPhrase(["", null, "  "])).toBeNull();
    expect(seasonLine("PRINTEMPS", null)).not.toMatch(/avec/);
  });
  it("un, deux, trois chiens", () => {
    expect(dogPhrase(["Uma"])).toBe("Uma");
    expect(dogPhrase(["Uma", "Rex"])).toBe("Uma et Rex");
    expect(dogPhrase(["Uma", "Rex", "Kiko"])).toBe("Uma, Rex et Kiko");
  });
  it("au-delà de trois : « vos compagnons »", () => expect(dogPhrase(["A", "B", "C", "D"])).toBe("vos compagnons"));
  it("élision : d'Uma, de Rex", () => {
    expect(deName("Uma")).toBe("d'Uma");
    expect(deName("Rex")).toBe("de Rex");
    expect(seasonLine("HIVER", "Uma")).toContain("prenez soin de vous et d'Uma");
  });
  it("aucune météo affirmée", () => {
    for (const s of ["PRINTEMPS", "ETE", "AUTOMNE", "HIVER"] as const) {
      expect(seasonLine(s, "Uma")).not.toMatch(/pluie|soleil|neige|orage|degr|°|beau temps|il fait/i);
    }
  });
});

describe("salutation", () => {
  it("première visite du jour : message complet avec prénom, saison et chien", () => {
    const g = buildGreeting({ name: "Lucas", dogNames: ["Uma"], date: d("2026-04-10"), full: true });
    expect(g.title).toBe("Bonjour Lucas, heureux de vous retrouver.");
    expect(g.lines[0]).toBe("Voici ce qui se passe dans votre espace aujourd'hui.");
    expect(g.lines[1]).toBe("Les journées s'allongent : une belle saison pour les balades avec Uma.");
  });
  it("message neutre sans prénom ni chien", () => {
    const g = buildGreeting({ name: "", date: d("2026-11-12"), full: true });
    expect(g.title).toBe("Bonjour, heureux de vous retrouver.");
    expect(g.lines.join(" ")).not.toMatch(/avec|et d'|et de /);
  });
  it("visites suivantes du jour : salutation courte, sans phrase répétée", () => {
    const g = buildGreeting({ name: "Lucas", dogNames: ["Uma"], date: d("2026-04-10"), full: false, roleMessage: "Votre pass." });
    expect(g).toEqual({ title: "Bonjour Lucas", lines: ["Votre pass."] });
  });
  it("jour local sur 10 caractères", () => expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05"));
});
