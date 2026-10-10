import { describe, expect, it } from "vitest";
import { buildRows, parseHelloAssoCsv, toCsv } from "./finance-export";

describe("export comptable", () => {
  it("formate le montant avec une virgule et 2 décimales", () => {
    const [r] = buildRows([{ entry_date: "2026-01-02", direction: "RECETTE", category: "ADHESION", amount: 20, status: "RECU" }]);
    expect(r!.montant).toBe("20,00");
    expect(r!.type).toBe("Recette");
  });
  it("neutralise une formule injectée dans le CSV", () => {
    const rows = buildRows([{ entry_date: "2026-01-02", direction: "DEPENSE", category: "ACHAT", amount: 5, status: "PAYE", description: "=HYPERLINK(1)" }]);
    expect(toCsv(rows).split("\r\n")[1]).toContain("'=HYPERLINK(1)");
  });
});

describe("lecture CSV HelloAsso", () => {
  it("convertit les dates JJ/MM/AAAA et lit le montant", () => {
    const [r] = parseHelloAssoCsv("id;email;prenom;nom;debut;fin;montant\nH1;a@b.fr;Zoé;Test;01/09/2026;31/08/2027;25,50");
    expect(r).toEqual({ id: "H1", email: "a@b.fr", prenom: "Zoé", nom: "Test", debut: "2026-09-01", fin: "2027-08-31", montant: 25.5 });
  });
});
