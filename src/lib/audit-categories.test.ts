import { describe, expect, it } from "vitest";
import { auditCategory, auditLabel } from "./audit-categories";

describe("historique unifié — catégories", () => {
  it("classe les actions réellement journalisées", () => {
    expect(auditCategory("membership.refused")).toBe("MEMBRES");
    expect(auditCategory("MEMBER_LEVEL_UPDATED")).toBe("MEMBRES");
    expect(auditCategory("account.closed_by_bureau")).toBe("MEMBRES");
    expect(auditCategory("accounting.update")).toBe("FINANCES");
    expect(auditCategory("reimbursement.paid")).toBe("FINANCES");
    expect(auditCategory("finance.insert")).toBe("FINANCES");
    expect(auditCategory("TASK_VALIDATED")).toBe("PROJETS");
    expect(auditCategory("project.update")).toBe("PROJETS");
    expect(auditCategory("DOG_ACCESS_REVOKED")).toBe("CHIENS");
    expect(auditCategory("role.assign")).toBe("HABILITATIONS");
    expect(auditCategory("DELEGATION_CREATE")).toBe("HABILITATIONS");
    expect(auditCategory("PASS_VALIDATOR_ON")).toBe("HABILITATIONS");
    expect(auditCategory("LOYALTY_MANUAL_STAMP")).toBe("FIDELITE");
    expect(auditCategory("PASS_PERSONAL_ON")).toBe("FIDELITE");
  });

  it("les imports HelloAsso relèvent des adhésions", () => {
    expect(auditCategory("integration.TO_REVIEW")).toBe("MEMBRES");
    expect(auditLabel("integration.TO_REVIEW")).toBe("Import HelloAsso — à valider");
  });

  it("une annulation suit la catégorie de l'action d'origine", () => {
    expect(auditCategory("project.create.undo")).toBe("PROJETS");
  });

  it("un événement inconnu reste lisible", () => {
    expect(auditCategory("CONFIG_OPTION_UPDATED")).toBe("AUTRE");
    expect(auditCategory("SOMETHING_NEW")).toBe("AUTRE");
    expect(auditLabel("SOMETHING_NEW")).toBe("Something new");
  });
});
