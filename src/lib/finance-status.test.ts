import { describe, expect, it } from "vitest";
import { canProcessReimbursement, nextReimbursementActions, summarizeReimbursements } from "./finance-status";

describe("remboursements", () => {
  it("une demande en attente ne peut pas être payée directement", () => {
    expect(nextReimbursementActions("PENDING")).not.toContain("PAID");
  });
  it("une demande approuvée peut être payée", () => {
    expect(nextReimbursementActions("APPROVED")).toContain("PAID");
  });
  it("une demande payée est figée", () => {
    expect(nextReimbursementActions("PAID")).toEqual([]);
  });
  it("le Bureau ne traite pas sa propre demande", () => {
    expect(canProcessReimbursement("a", "a", true)).toBe(false);
    expect(canProcessReimbursement("a", "b", true)).toBe(true);
    expect(canProcessReimbursement("a", "b", false)).toBe(false);
  });
  it("sépare en attente, à payer et payé sans double compte", () => {
    const s = summarizeReimbursements([
      { amount: "10.10", status: "PENDING" },
      { amount: 20.2, status: "APPROVED" },
      { amount: 5, status: "PAID" },
      { amount: 7, status: "REJECTED" },
    ]);
    expect(s).toEqual({ pending: 10.1, approved: 20.2, paid: 5, rejected: 7 });
  });
});

import { balancesByMember, payoutLabel, summarizePayouts } from "./finance-status";
describe("soldes et reversements", () => {
  it("calcule le solde par membre sans compter les refus", () => {
    const b = balancesByMember([
      { person_id: "a", amount: 10, status: "APPROVED" },
      { person_id: "a", amount: 5, status: "PAID" },
      { person_id: "a", amount: 7, status: "REJECTED" },
      { person_id: "b", amount: 3, status: "PENDING" },
    ]);
    expect(b[0]).toEqual({ personId: "a", pending: 0, toPay: 10, paid: 5 });
    expect(b[1]).toEqual({ personId: "b", pending: 3, toPay: 0, paid: 0 });
  });
  it("un reversement sans date est à payer", () => {
    expect(payoutLabel(null)).toBe("À payer");
    expect(payoutLabel("2026-10-01")).toBe("Payé");
    expect(summarizePayouts([{ professional_share: 20, professional_paid_at: null }, { professional_share: 12.5, professional_paid_at: "2026-10-01" }])).toEqual({ paid: 12.5, due: 20 });
  });
});

import { allowedReimbursementActions } from "./finance-status";
describe("droits de traitement des remboursements", () => {
  const all = { validate: true, markPaid: true };
  it("personne ne traite sa propre demande, même avec tous les droits", () => {
    expect(allowedReimbursementActions("PENDING", "a", "a", all)).toEqual([]);
    expect(allowedReimbursementActions("APPROVED", "a", "a", all)).toEqual([]);
  });
  it("approuver ou refuser exige le droit de validation", () => {
    expect(allowedReimbursementActions("PENDING", "a", "b", { validate: false, markPaid: true })).toEqual([]);
    expect(allowedReimbursementActions("PENDING", "a", "b", { validate: true, markPaid: false })).toEqual(["APPROVED", "REJECTED"]);
  });
  it("payer exige le droit de paiement et une demande approuvée", () => {
    expect(allowedReimbursementActions("APPROVED", "a", "b", { validate: false, markPaid: true })).toEqual(["PAID"]);
    expect(allowedReimbursementActions("APPROVED", "a", "b", { validate: true, markPaid: false })).toEqual(["REJECTED"]);
    expect(allowedReimbursementActions("PENDING", "a", "b", { validate: false, markPaid: true })).toEqual([]);
  });
  it("une demande refusée ou payée est figée", () => {
    expect(allowedReimbursementActions("REJECTED", "a", "b", all)).toEqual([]);
    expect(allowedReimbursementActions("PAID", "a", "b", all)).toEqual([]);
  });
});
