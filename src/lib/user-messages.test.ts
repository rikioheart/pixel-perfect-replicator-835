import { describe, expect, it, vi } from "vitest";
import { GENERIC_ERROR, NOT_ALLOWED, couldNot, humanizeError, isFrenchMessage } from "./user-messages";

describe("humanizeError", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  it("garde tel quel un message métier en français", () => {
    expect(humanizeError(new Error("Seul le Bureau peut valider cette demande."))).toBe(
      "Seul le Bureau peut valider cette demande.",
    );
  });

  it("garde les consignes françaises courtes, même sans accent", () => {
    expect(humanizeError(new Error("Indiquez le motif."))).toBe("Indiquez le motif.");
    expect(humanizeError(new Error("Connexion requise."))).toBe("Connexion requise.");
  });

  it("ne montre pas une courte erreur anglaise", () => {
    expect(humanizeError(new Error("Bucket not found"))).toBe("Nous ne trouvons pas cet élément : il a peut-être été retiré, ou il ne vous est pas accessible.");
    expect(humanizeError(new Error("Cannot read properties of undefined"))).toBe(GENERIC_ERROR);
  });

  it("traduit un refus de droits de la base", () => {
    expect(humanizeError({ code: "42501", message: "new row violates row-level security policy for table \"tasks\"" })).toBe(
      "Cette action est réservée à d'autres responsables. Si vous en avez besoin, le Bureau peut vous aider.",
    );
  });

  it("traduit une coupure réseau", () => {
    expect(humanizeError(new TypeError("Failed to fetch"))).toBe(
      "La connexion semble coupée pour le moment. Vérifiez votre réseau, puis réessayez.",
    );
  });

  it("traduit un doublon", () => {
    expect(humanizeError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe("C'est déjà enregistré : inutile de le refaire.");
  });

  it("traduit une session expirée", () => {
    expect(humanizeError({ message: "JWT expired" })).toBe("Par sécurité, votre session s'est terminée. Reconnectez-vous pour reprendre là où vous en étiez.");
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

  it("propose un message de secours bienveillant, sans mot « impossible »", () => {
    expect(couldNot("enregistrer vos changements")).toBe(
      "Nous n'avons pas pu enregistrer vos changements pour le moment. Réessayez dans un instant.",
    );
    expect(GENERIC_ERROR).toBe(
      "Cela n'a pas fonctionné cette fois-ci. Réessayez dans un instant ; si cela continue, le Bureau peut vous aider.",
    );
  });

  it("oriente vers le Bureau quand un droit manque", () => {
    expect(humanizeError({ message: "permission denied for table dogs" })).toBe(NOT_ALLOWED);
    expect(NOT_ALLOWED).toContain("le Bureau peut vous aider");
  });
});
