import { describe, expect, it } from "vitest";
import { formatParisDate, formatParisDateTime, fromParisInput, mapsUrl, safeGoogleBusinessUrl, toParisInput } from "./places";

describe("places", () => {
  it("encode l'adresse pour Google Maps", () => {
    expect(mapsUrl("12 rue de la Paix, Paris")).toBe("https://www.google.com/maps/search/?api=1&query=12%20rue%20de%20la%20Paix%2C%20Paris");
  });
  it("n'accepte que des fiches Google en HTTPS", () => {
    expect(safeGoogleBusinessUrl("https://g.page/mon-salon")).toBe("https://g.page/mon-salon");
    expect(safeGoogleBusinessUrl("https://maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
    expect(safeGoogleBusinessUrl("http://g.page/x")).toBeNull();
    expect(safeGoogleBusinessUrl("https://evil.com/google.com")).toBeNull();
    expect(safeGoogleBusinessUrl("javascript:alert(1)")).toBeNull();
  });
  it("affiche jour/mois/année et heure de Paris", () => {
    expect(formatParisDate("2026-10-23")).toBe("23/10/2026");
    expect(formatParisDateTime("2026-10-23T18:28:00Z")).toBe("23/10/2026 à 20:28");
    expect(formatParisDateTime("2026-12-31T23:30:00Z")).toBe("01/01/2027 à 00:30");
  });
  it("saisie en heure de Paris aller-retour", () => {
    expect(toParisInput("2026-10-23T18:28:00Z")).toBe("2026-10-23T20:28");
    expect(fromParisInput("2026-10-23T20:28")).toBe("2026-10-23T18:28:00.000Z");
    expect(fromParisInput("2026-01-15T10:00")).toBe("2026-01-15T09:00:00.000Z");
  });
});
