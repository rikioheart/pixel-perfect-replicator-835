import { describe, expect, it } from "vitest";
import {
  availableQuantity,
  movementChange,
  reservationCounts,
  validateItemDraft,
  validateReservationDraft,
} from "./inventory";

describe("inventaire — réservations", () => {
  it("les réservations rendues ou annulées ne réduisent pas le disponible", () => {
    expect(reservationCounts("ACTIVE")).toBe(true);
    expect(reservationCounts("RETURNED")).toBe(false);
    expect(reservationCounts("CANCELLED")).toBe(false);
  });

  it("disponible = stock − réservé, jamais négatif", () => {
    expect(availableQuantity(5, 2)).toBe(3);
    expect(availableQuantity(2, 5)).toBe(0);
  });

  it("refuse une réservation supérieure au disponible", () => {
    const d = { projectId: "p", quantity: 4, startDate: "2026-11-10", endDate: null };
    expect(validateReservationDraft(d, 3)).toMatch(/Stock insuffisant/);
    expect(validateReservationDraft({ ...d, quantity: 3 }, 3)).toBeNull();
  });

  it("refuse une période inversée et un projet absent", () => {
    expect(validateReservationDraft({ projectId: "p", quantity: 1, startDate: "2026-11-10", endDate: "2026-11-09" }, 5)).not.toBeNull();
    expect(validateReservationDraft({ projectId: "", quantity: 1, startDate: "2026-11-10", endDate: null }, 5)).not.toBeNull();
  });
});

describe("inventaire — références et mouvements", () => {
  it("seuls désignation, type et quantité sont obligatoires", () => {
    expect(validateItemDraft({ name: "Plots", type: "MATERIEL", quantity: "12" })).toBeNull();
    expect(validateItemDraft({ name: "", type: "MATERIEL", quantity: "1" })).not.toBeNull();
    expect(validateItemDraft({ name: "Plots", type: "", quantity: "1" })).not.toBeNull();
    expect(validateItemDraft({ name: "Plots", type: "MATERIEL", quantity: "-1" })).not.toBeNull();
  });

  it("un lien de document doit être en http(s)", () => {
    expect(validateItemDraft({ name: "Plots", type: "VENTE", quantity: "1", document_url: "javascript:alert(1)" })).not.toBeNull();
    expect(validateItemDraft({ name: "Plots", type: "VENTE", quantity: "1", document_url: "https://drive.google.com/x" })).toBeNull();
  });

  it("une sortie est négative, une entrée positive, zéro refusé", () => {
    expect(movementChange("IN", "3")).toBe(3);
    expect(movementChange("OUT", "3")).toBe(-3);
    expect(movementChange("OUT", "0")).toBeNull();
  });
});
