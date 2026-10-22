import { describe, expect, it } from "vitest";
import { normalizePassInput, passShortCode } from "./pass-code";

const QR = "7b29c4e1-5a6f-4d2b-9c8e-112233445566";

describe("Pass Terrain code", () => {
  it("affiche un code court de 8 caractères en deux blocs", () => {
    expect(passShortCode(QR)).toBe("7B29-C4E1");
  });
  it("reconnaît le code complet scanné", () => {
    expect(normalizePassInput(QR)).toBe("7b29c4e15a6f4d2b9c8e112233445566");
  });
  it("reconnaît le code court saisi avec ou sans tiret", () => {
    expect(normalizePassInput("7b29-c4e1")).toBe("7b29c4e1");
    expect(normalizePassInput(" 7B29C4E1 ")).toBe("7b29c4e1");
  });
  it("refuse un texte qui n'est pas un pass", () => {
    expect(normalizePassInput("bonjour")).toBeNull();
    expect(normalizePassInput("7b29")).toBeNull();
  });
});
