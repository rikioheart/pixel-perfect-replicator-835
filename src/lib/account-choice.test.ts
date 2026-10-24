import { describe, expect, it } from "vitest";
import { hasDeletionBlockers, isValidSiret, needsAccountChoice } from "./account-choice";

describe("choix du parcours", () => {
  it("est demandé à un nouveau compte en attente sans choix", () => {
    expect(needsAccountChoice({ membership_status: "PENDING", account_choice_at: null })).toBe(true);
  });
  it("n'est jamais redemandé une fois fait", () => {
    expect(needsAccountChoice({ membership_status: "PENDING", account_choice_at: "2026-10-24" })).toBe(false);
  });
  it("n'est pas demandé à un membre déjà actif", () => {
    expect(needsAccountChoice({ membership_status: "ACTIVE", account_choice_at: null })).toBe(false);
  });
});

describe("SIRET", () => {
  it("accepte 14 chiffres ou vide", () => {
    expect(isValidSiret("123 456 789 00012")).toBe(true);
    expect(isValidSiret("")).toBe(true);
  });
  it("refuse un SIRET incomplet", () => expect(isValidSiret("12345")).toBe(false));
});

describe("suppression de compte", () => {
  it("est bloquée par un projet en cours dont on est responsable", () => {
    expect(hasDeletionBlockers({ projects: [{ id: "1", title: "P" }], reimbursements: 0 })).toBe(true);
  });
  it("est bloquée par un remboursement non soldé", () => {
    expect(hasDeletionBlockers({ projects: [], reimbursements: 1 })).toBe(true);
  });
  it("est possible sans dépendance", () => {
    expect(hasDeletionBlockers({ projects: [], reimbursements: 0 })).toBe(false);
  });
});
