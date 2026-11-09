import { describe, expect, it } from "vitest";
import { agResolutions, annualAccounts, categoryLabel, resultLabel, type LedgerEntry } from "./annual-accounts";

const e = (over: Partial<LedgerEntry>): LedgerEntry => ({ entry_date: "2026-03-10", direction: "RECETTE", category: "ADHESION", amount: 10, status: "RECU", ...over });

describe("comptes annuels loi 1901", () => {
  it("ventile cotisations, dons/mécénat, activités, matériel et déplacements", () => {
    const a = annualAccounts([
      e({ category: "ADHESION", amount: 300 }),
      e({ category: "DON", amount: 50 }),
      e({ category: "MECENAT", amount: 150 }),
      e({ category: "ACTIVITE", amount: 120 }),
      e({ direction: "DEPENSE", category: "MATERIEL", amount: 80, status: "PAYE" }),
      e({ direction: "DEPENSE", category: "DEPLACEMENT", amount: 40, status: "PAYE" }),
    ], "2026-01-01", "2026-12-31");
    const inc = Object.fromEntries(a.income.map((l) => [l.key, l.amount]));
    const exp = Object.fromEntries(a.expenses.map((l) => [l.key, l.amount]));
    expect(inc.cotisations).toBe(300);
    expect(inc.dons).toBe(200);
    expect(inc.activites).toBe(120);
    expect(exp.materiel).toBe(80);
    expect(exp.deplacements).toBe(40);
    expect(a.totalIncome).toBe(620);
    expect(a.totalExpenses).toBe(120);
    expect(a.result).toBe(500);
    expect(a.kind).toBe("EXCEDENT");
  });

  it("exclut les opérations annulées et hors période", () => {
    const a = annualAccounts([
      e({ amount: 100, status: "ANNULE" }),
      e({ amount: 70, entry_date: "2025-12-31" }),
      e({ amount: 30 }),
    ], "2026-01-01", "2026-12-31");
    expect(a.totalIncome).toBe(30);
  });

  it("garde « à recevoir » et « à payer » hors résultat, affichés comme engagements", () => {
    const a = annualAccounts([
      e({ amount: 40, status: "A_RECEVOIR" }),
      e({ direction: "DEPENSE", category: "ACHAT", amount: 25, status: "A_PAYER" }),
    ], "2026-01-01", "2026-12-31");
    expect(a.result).toBe(0);
    expect(a.kind).toBe("EQUILIBRE");
    expect(a.pendingIncome).toBe(40);
    expect(a.pendingExpenses).toBe(25);
  });

  it("déficit : résolution d'imputation et libellé", () => {
    const a = annualAccounts([e({ direction: "DEPENSE", category: "FONCTIONNEMENT", amount: 90, status: "PAYE" })], "2026-01-01", "2026-12-31");
    expect(a.kind).toBe("DEFICIT");
    expect(resultLabel(a)).toContain("Déficit");
    const r = agResolutions(a, "2026-01-01", "2026-12-31");
    expect(r.map((x) => x.title)).toEqual(["1. Approbation des comptes", "2. Affectation du résultat", "3. Quitus au trésorier"]);
    expect(r[1].text).toContain("imputer le déficit");
  });

  it("une catégorie inconnue tombe dans « Autres »", () => {
    const a = annualAccounts([e({ category: "MYSTERE", amount: 5 })], "2026-01-01", "2026-12-31");
    expect(a.income.find((l) => l.key === "autres")?.amount).toBe(5);
    expect(categoryLabel("DEPLACEMENT")).toBe("Frais de déplacement");
  });
});
