import { describe, expect, it } from "vitest";
import { EMPTY_CONTACT, buildContactInsert, contactProblem, exactContactPattern } from "./quick-contact";

describe("contact rapide", () => {
  it("la recherche anti-doublon ne traite pas % et _ comme des jokers", () => {
    expect(exactContactPattern("  Truffe_100%  ")).toBe("Truffe\\_100\\%");
    expect(exactContactPattern("A\\B")).toBe("A\\\\B");
    expect(exactContactPattern("Mairie de Pau")).toBe("Mairie de Pau");
  });
  it("une personne demande au moins un prénom ou un nom ; une organisation, son nom", () => {
    expect(contactProblem("PARTICULIER", EMPTY_CONTACT)).not.toBeNull();
    expect(contactProblem("PARTICULIER", { ...EMPTY_CONTACT, lastName: "Durand" })).toBeNull();
    expect(contactProblem("MAIRIE", { ...EMPTY_CONTACT, firstName: "Léa" })).not.toBeNull();
    expect(contactProblem("PARTENAIRE", { ...EMPTY_CONTACT, organization: "Croquettes du Val" })).toBeNull();
  });

  it("refuse un e-mail incomplet", () => {
    expect(contactProblem("PARTICULIER", { ...EMPTY_CONTACT, firstName: "Léa", email: "lea@" })).not.toBeNull();
  });

  it("une personne devient une fiche sans compte, jamais un compte", () => {
    const ins = buildContactInsert("PROFESSIONNEL", { ...EMPTY_CONTACT, firstName: " Léa ", organization: "Éduc'chien", email: "Lea@Mail.fr " }, "u1");
    expect(ins.table).toBe("people");
    if (ins.table !== "people") return;
    expect(ins.row).toMatchObject({ first_name: "Léa", display_name: "Léa", email: "lea@mail.fr", contact_type: "PROFESSIONNEL", organization: "Éduc'chien", created_by: "u1" });
  });

  it("un particulier ne garde pas de structure ; une mairie part en prospect", () => {
    const p = buildContactInsert("PARTICULIER", { ...EMPTY_CONTACT, lastName: "Durand", organization: "X" }, null);
    expect(p.table === "people" && p.row.organization).toBeNull();
    const m = buildContactInsert("MAIRIE", { ...EMPTY_CONTACT, organization: "Mairie de Pau" }, null);
    expect(m).toMatchObject({ table: "mairies", row: { organization: "Mairie de Pau", status: "PROSPECT" } });
  });
});
