import { describe, expect, it, vi } from "vitest";
import { GENERIC_ERROR, humanizeError, isFrenchMessage } from "./user-messages";

describe("humanizeError", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  it("garde tel quel un message métier en français", () => {
    expect(humanizeError(new Error("Seul le Bureau peut valider cette demande."))).toBe(
      "Seul le Bureau peut valider cette demande.",
    );
  });

  it("traduit un refus de droits de la base", () => {
    expect(humanizeError({ code: "42501", message: "new row violates row-level security policy for table \"tasks\"" })).toBe(
      "Vous n'avez pas l'autorisation de faire cette action.",
    );
  });

  it("traduit une coupure réseau", () => {
    expect(humanizeError(new TypeError("Failed to fetch"))).toBe(
      "Connexion impossible pour le moment. Vérifiez votre réseau, puis réessayez.",
    );
  });

  it("traduit un doublon", () => {
    expect(humanizeError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe("Cet élément existe déjà.");
  });

  it("traduit une session expirée", () => {
    expect(humanizeError({ message: "JWT expired" })).toBe("Votre session a expiré. Reconnectez-vous pour continuer.");
  });

  it("n'affiche jamais un message technique inconnu en anglais", () => {
    expect(humanizeError(new Error("column foo.bar does not exist"))).toBe(GENERIC_ERROR);
    expect(humanizeError(new Error("column foo.bar does not exist"), "Enregistrement impossible.")).toBe("Enregistrement impossible.");
  });

  it("garde l'information technique dans le journal", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    humanizeError(new Error("column foo.bar does not exist"));
    expect(warn).toHaveBeenCalledWith("[erreur technique]", "-", "column foo.bar does not exist");
  });

  it("utilise le message de secours sans erreur", () => {
    expect(humanizeError(null)).toBe(GENERIC_ERROR);
  });

  it("distingue français et anglais", () => {
    expect(isFrenchMessage("Vous n'avez pas le droit.")).toBe(true);
    expect(isFrenchMessage("permission denied for table x")).toBe(false);
  });
});
