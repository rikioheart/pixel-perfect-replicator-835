import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, googleCalendarUrl } from "./calendar-export";
import { isGoogleFormUrl, isSafeExternalFormUrl } from "./form-links";
import { resolveDark } from "./user-preferences";
import { decisionTaskMarker } from "./governance";
import { parseHelloAssoCsv } from "./finance-export";

describe("export agenda", () => {
  const item = { uid: "activity-1", title: "Balade, éducation; ensemble", start: "2026-10-25T08:30:00Z", location: "Parc, Lyon" };

  it("convertit une heure de Paris en UTC sans décalage au changement d'heure", () => {
    // 25/10/2026 : passage à l'heure d'hiver. 09:30 Paris (UTC+1) = 08:30Z.
    const ics = buildIcs(item, new Date("2026-10-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261025T083000Z");
    expect(ics).toContain("DTEND:20261025T103000Z");
  });

  it("échappe virgules et points-virgules", () => {
    expect(escapeIcsText("a,b;c\nd")).toBe("a\\,b\\;c\\nd");
    expect(buildIcs(item)).toContain("SUMMARY:Balade\\, éducation\\; ensemble");
  });

  it("prépare un lien Google Agenda encodé", () => {
    const url = new URL(googleCalendarUrl(item));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261025T083000Z/20261025T103000Z");
    expect(url.searchParams.get("text")).toBe(item.title);
  });
});

describe("liens Google Forms", () => {
  it("accepte uniquement https", () => {
    expect(isSafeExternalFormUrl("https://forms.gle/abc")).toBe(true);
    expect(isSafeExternalFormUrl("http://forms.gle/abc")).toBe(false);
    expect(isSafeExternalFormUrl("javascript:alert(1)")).toBe(false);
    expect(isGoogleFormUrl("https://docs.google.com/forms/d/x/viewform")).toBe(true);
  });
});

describe("thème", () => {
  it("suit l'appareil en automatique", () => {
    expect(resolveDark("SYSTEM", true)).toBe(true);
    expect(resolveDark("LIGHT", true)).toBe(false);
    expect(resolveDark("DARK", false)).toBe(true);
  });
});

describe("décision vers tâche", () => {
  it("marqueur stable par décision", () => {
    expect(decisionTaskMarker("abc")).toBe("[registre:abc]");
  });
});

describe("import HelloAsso", () => {
  it("lit champs entre guillemets, accents, dates et montants", () => {
    const csv = '\uFEFFID;Email;Prénom;Nom;Début;Fin;Montant\n"H1";Ana@Ex.fr;"Zoé; Marie";"Dupont\nB";1/9/2026;31/08/2027;"1 234,50 €"\n';
    const [r] = parseHelloAssoCsv(csv);
    expect(r).toEqual({ id: "H1", email: "ana@ex.fr", prenom: "Zoé; Marie", nom: "Dupont\nB", debut: "2026-09-01", fin: "2027-08-31", montant: 1234.5 });
  });
  it("laisse vide une date invalide", () => {
    const [r] = parseHelloAssoCsv("id,email,debut\nX,a@b.fr,demain\n");
    expect(r!.debut).toBe("");
  });
});
