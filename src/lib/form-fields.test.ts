import { describe, expect, it } from "vitest";
import { fieldType, normalizeFields, validateAnswer } from "./form-fields";

describe("questions de formulaire", () => {
  it("un ancien champ long reste un texte long", () => {
    expect(fieldType({ label: "Message", required: true, long: true })).toBe("long");
  });
  it("le mot « test » n'est jamais bloqué", () => {
    expect(normalizeFields([{ label: "test", required: false, type: "short" }])[0]?.label).toBe("test");
  });
  it("une question vide est retirée avant enregistrement", () => {
    expect(normalizeFields([{ label: "  ", required: true }, { label: "Nom", required: true }])).toHaveLength(1);
  });
  it("un choix unique exige au moins deux options", () => {
    expect(() => normalizeFields([{ label: "Taille", required: true, type: "single", options: ["Petit"] }])).toThrow();
  });
  it("un e-mail invalide est refusé", () => {
    expect(validateAnswer({ label: "Mail", required: true, type: "email" }, "abc")).not.toBeNull();
  });
  it("une question facultative vide est acceptée", () => {
    expect(validateAnswer({ label: "Âge", required: false, type: "number" }, "")).toBeNull();
  });
});
