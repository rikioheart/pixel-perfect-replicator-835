import { describe, expect, it } from "vitest";
import { membershipDecisionMessage } from "./membership-decision";

describe("décision d'adhésion", () => {
  it("une demande déjà traitée est signalée, jamais revalidée", () => {
    const r = membershipDecisionMessage(null, { ok: false, reason: "ALREADY_PROCESSED", status: "ACTIVE" }, "ACTIVE");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/déjà été traitée/);
  });
  it("un refus de droit en base devient un message explicite", () => {
    const r = membershipDecisionMessage("Droit de validation des adhésions requis", null, "ACTIVE");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/valider les adhésions/);
  });
  it("personne ne décide de sa propre adhésion", () => {
    expect(membershipDecisionMessage("Vous ne pouvez pas valider votre propre adhésion", null, "ACTIVE").ok).toBe(false);
  });
  it("un échec sans réponse n'est jamais présenté comme un succès", () => {
    expect(membershipDecisionMessage(null, null, "REFUSED").ok).toBe(false);
  });
  it("une décision appliquée est confirmée", () => {
    expect(membershipDecisionMessage(null, { ok: true, status: "REFUSED" }, "REFUSED")).toEqual({ ok: true, message: "Demande refusée. La personne est prévenue." });
  });
});
