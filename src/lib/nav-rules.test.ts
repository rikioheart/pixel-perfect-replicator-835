import { describe, expect, it } from "vitest";
import { canOpenProSpace, isNavItemPrimary, isNavItemVisible, memberHubTabFor, memberHubGroupFor, MEMBER_HUB_GROUPS, MEMBER_HUB_TABS } from "./nav-rules";

const particulier = { isBureau: false, isPro: false };
const pro = { isBureau: false, isPro: true };
const bureau = { isBureau: true, isPro: false };

describe("navigation par rôle", () => {
  it("conserve toutes les pages personnelles dans quatre familles", () => {
    expect(MEMBER_HUB_GROUPS).toHaveLength(4);
    for (const tab of MEMBER_HUB_TABS) expect(memberHubGroupFor(tab.to)).toBeDefined();
    expect(memberHubGroupFor('/terrain')?.to).toBe('/participations');
  });
  it("un particulier ne voit pas les entrées Bureau", () => {
    expect(isNavItemVisible({ audience: "bureau" }, particulier)).toBe(false);
  });
  it("un particulier ne voit pas le jargon projet masqué", () => {
    expect(isNavItemVisible({ audience: "all", hideForParticulier: true }, particulier)).toBe(false);
  });
  it("un pro voit les entrées pro, pas celles du Bureau", () => {
    expect(isNavItemVisible({ audience: "pro" }, pro)).toBe(true);
    expect(isNavItemVisible({ audience: "bureau" }, pro)).toBe(false);
  });
  it("le Bureau voit les entrées pro", () => {
    expect(isNavItemVisible({ audience: "pro" }, bureau)).toBe(true);
  });
  it("Projets n'est pas une entrée principale pour un particulier", () => {
    expect(isNavItemPrimary({ audience: "all", primary: true }, particulier)).toBe(false);
    expect(isNavItemPrimary({ audience: "all", primary: true }, pro)).toBe(true);
  });
  it("les pages foyer et fidélité appartiennent à l'espace unifié", () => {
    expect(memberHubTabFor("/foyer")).toBe("/foyer");
    expect(memberHubTabFor("/loyalty")).toBe("/loyalty");
    expect(memberHubTabFor("/projects")).toBeNull();
  });
  it("un particulier connecté n'ouvre pas l'espace pro, un pro et le Bureau oui", () => {
    expect(canOpenProSpace({ ...particulier, rolesReady: true })).toBe(false);
    expect(canOpenProSpace({ ...pro, rolesReady: true })).toBe(true);
    expect(canOpenProSpace({ ...bureau, rolesReady: true })).toBe(true);
  });
  it("refus par défaut tant que le statut n'est pas vérifié", () => {
    expect(canOpenProSpace({ ...pro, rolesReady: false })).toBe(false);
    expect(canOpenProSpace({ ...particulier, rolesReady: false })).toBe(false);
  });
});
