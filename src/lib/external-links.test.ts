import { describe, expect, it } from "vitest";
import { detectService, normalizeUrl } from "./external-links";

describe("liens externes", () => {
  it("reconnaît les services Google et Rintintin", () => {
    expect(detectService("https://docs.google.com/forms/d/e/abc/viewform")).toBe("FORMS");
    expect(detectService("https://docs.google.com/spreadsheets/d/abc/edit")).toBe("SHEETS");
    expect(detectService("https://drive.google.com/drive/folders/abc")).toBe("DRIVE");
    expect(detectService("https://meet.google.com/abc-defg-hij")).toBe("MEET");
    expect(detectService("https://www.rintintin.app/reserver/lvdc")).toBe("RINTINTIN");
  });
  it("garde un lien générique pour un service inconnu", () => {
    expect(detectService("https://exemple.fr/page")).toBe("LINK");
  });
  it("ajoute https:// et refuse les liens dangereux", () => {
    expect(normalizeUrl("exemple.fr/a")).toBe("https://exemple.fr/a");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("pas un lien")).toBeNull();
  });
});
