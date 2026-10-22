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
