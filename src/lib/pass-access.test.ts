import { describe, expect, it } from "vitest";
import { canReceiveStamps, canStamp, canToggleValidator, needsPersonalPassActivation, showsActivationScreen, validatorSource, type PassAccess } from "./pass-access";

const base: PassAccess = {
  membership_type: "PARTICULIER", membership_status: "ACTIVE", is_pro: false, is_bureau: false,
  personal_pass_at: null, validator_at: null, is_validator: false, can_receive_stamps: true,
};
const at = "2026-10-24T15:00:00Z";

describe("statut valideur du Pass Terrain", () => {
  it("un pro validé est valideur d'office", () => expect(validatorSource({ ...base, is_pro: true })).toBe("PRO"));
  it("un membre du Bureau n'est pas valideur avant activation", () => expect(validatorSource({ ...base, is_bureau: true })).toBeNull());
  it("un membre du Bureau devient valideur après activation", () => expect(validatorSource({ ...base, is_bureau: true, validator_at: at })).toBe("BUREAU"));
  it("un particulier n'est jamais valideur", () => expect(validatorSource({ ...base, validator_at: at })).toBeNull());
  it("seul le Bureau non pro peut activer ou suspendre", () => {
    expect(canToggleValidator({ is_pro: false, is_bureau: true })).toBe(true);
    expect(canToggleValidator({ is_pro: true, is_bureau: true })).toBe(false);
    expect(canToggleValidator({ is_pro: false, is_bureau: false })).toBe(false);
  });
  it("personne ne se tamponne soi-même", () => expect(canStamp({ ...base, is_pro: true }, "u1", "u1")).toBe(false));
  it("un valideur tamponne une autre personne", () => expect(canStamp({ ...base, is_pro: true }, "u1", "u2")).toBe(true));
});

describe("pass personnel et tampons", () => {
  it("un particulier actif reçoit des tampons sans activation", () => expect(canReceiveStamps(base)).toBe(true));
  it("un particulier en attente n'en reçoit pas", () => expect(canReceiveStamps({ ...base, membership_status: "PENDING" })).toBe(false));
  it("un pro sans pass activé n'en reçoit pas", () => expect(canReceiveStamps({ ...base, membership_type: "PROFESSIONNEL" })).toBe(false));
  it("un pro avec pass activé en reçoit comme un particulier", () =>
    expect(canReceiveStamps({ ...base, membership_type: "PROFESSIONNEL", personal_pass_at: at })).toBe(true));
  it("seuls les non-particuliers voient l'activation du pass personnel", () => {
    expect(needsPersonalPassActivation({ membership_type: "PARTICULIER" })).toBe(false);
    expect(needsPersonalPassActivation({ membership_type: "PROFESSIONNEL" })).toBe(true);
  });
  it("l'écran d'activation s'adresse au Bureau et aux pros", () => {
    expect(showsActivationScreen({ is_pro: false, is_bureau: false })).toBe(false);
    expect(showsActivationScreen({ is_pro: false, is_bureau: true })).toBe(true);
    expect(showsActivationScreen({ is_pro: true, is_bureau: false })).toBe(true);
  });
});
