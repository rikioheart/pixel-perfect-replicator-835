import { describe, expect, it } from "vitest";
import { allowedVisibilities, guidesForViewer, parseHelpAnswer, trimConversation, type HelpGuide } from "./help-assistant";

const g = (id: string, visibility: string, status = "PUBLISHED") => ({ id, visibility, status });

describe("guides lus par l'assistant selon le profil", () => {
  const all = [g("a", "ALL"), g("p", "PRO_BUREAU"), g("b", "BUREAU"), g("x", "ALL", "PENDING")];
  it("particulier : guides « ALL » publiés seulement", () => {
    expect(guidesForViewer(all, { isBureau: false, isPro: false }).map((x) => x.id)).toEqual(["a"]);
  });
  it("professionnel : ALL et PRO_BUREAU", () => {
    expect(guidesForViewer(all, { isBureau: false, isPro: true }).map((x) => x.id)).toEqual(["a", "p"]);
  });
  it("Bureau : tous les guides publiés, jamais une proposition en attente", () => {
    expect(guidesForViewer(all, { isBureau: true, isPro: false }).map((x) => x.id)).toEqual(["a", "p", "b"]);
    expect(allowedVisibilities({ isBureau: true, isPro: true })).toHaveLength(3);
  });
});

describe("réponse de l'assistant", () => {
  const guides: HelpGuide[] = [
    { id: "g1", title: "Pass", module: "FIDELITE", summary: null, content: "…", visibility: "ALL" },
    { id: "g2", title: "Foyer", module: "ADHERENTS", summary: null, content: "…", visibility: "ALL" },
  ];
  it("ne cite que des guides fournis, sans doublon", () => {
    const r = parseHelpAnswer(JSON.stringify({ answer: "Ok", covered: true, guide_refs: ["G2", "G9", "g2"] }), guides);
    expect(r.guides).toEqual([{ id: "g2", title: "Foyer" }]);
    expect(r.covered).toBe(true);
  });
  it("question non couverte : aucun lien de guide", () => {
    const r = parseHelpAnswer(JSON.stringify({ answer: "Pas dans les guides", covered: false, guide_refs: ["G1"] }), guides);
    expect(r.covered).toBe(false);
    expect(r.guides).toEqual([]);
  });
  it("« couvert » sans guide cité est traité comme non couvert", () => {
    expect(parseHelpAnswer(JSON.stringify({ answer: "x", covered: true, guide_refs: [] }), guides).covered).toBe(false);
  });
  it("historique limité aux 8 derniers échanges", () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({ role: "user" as const, content: `q${i}` }));
    expect(trimConversation(turns)).toHaveLength(8);
  });
});
