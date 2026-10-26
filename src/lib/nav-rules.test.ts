import { describe, expect, it } from "vitest";
import { canCreateForm, canOpenProSpace, isNavItemPrimary, isNavItemVisible, memberHubTabFor, memberHubGroupFor, MEMBER_HUB_GROUPS, MEMBER_HUB_TABS } from "./nav-rules";
import { isParticulierView, canBookTerrain } from "./nav-rules";

const particulier = { isBureau: false, isPro: false };
const pro = { isBureau: false, isPro: true };
const bureau = { isBureau: true, isPro: false };

describe("navigation par rôle", () => {
  it("conserve toutes les pages personnelles dans quatre familles", () => {
    expect(MEMBER_HUB_GROUPS).toHaveLength(4);
    for (const tab of MEMBER_HUB_TABS) expect(memberHubGroupFor(tab.to)).toBeDefined();
    expect(memberHubGroupFor('/terrain')).toBeUndefined();
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
  it("un membre du Bureau particulier ne voit pas les entrées pro", () => {
    expect(isNavItemVisible({ audience: "pro" }, bureau)).toBe(false);
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
  it("seul un pro validé ouvre l'espace pro, pas un particulier ni un Bureau particulier", () => {
    expect(canOpenProSpace({ ...particulier, rolesReady: true })).toBe(false);
    expect(canOpenProSpace({ ...pro, rolesReady: true })).toBe(true);
    expect(canOpenProSpace({ ...bureau, rolesReady: true })).toBe(false);
  });
  it("refus par défaut tant que le statut n'est pas vérifié", () => {
    expect(canOpenProSpace({ ...pro, rolesReady: false })).toBe(false);
    expect(canOpenProSpace({ ...particulier, rolesReady: false })).toBe(false);
  });
  it("un particulier ne peut pas créer de formulaire, un pro et le Bureau oui", () => {
    expect(canCreateForm(particulier)).toBe(false);
    expect(canCreateForm(pro)).toBe(true);
    expect(canCreateForm(bureau)).toBe(true);
  });
});

describe("rôles cumulés", () => {
  it("un membre du Bureau n'est pas traité comme simple particulier mais garde l'accès au Pass", () => {
    expect(isParticulierView({ isBureau: true, isPro: false })).toBe(false);
    expect(isParticulierView({ isBureau: false, isPro: false })).toBe(true);
    expect(canOpenProSpace({ isBureau: false, isPro: false, rolesReady: true })).toBe(false);
  });
});

describe("Lot 1 : fonctions cumulées et terrain en pause", () => {
  const bureauPro = { isBureau: true, isPro: true };
  it("un membre du Bureau professionnel cumule Espace pro et Bureau", () => {
    expect(isNavItemVisible({ audience: "pro" }, bureauPro)).toBe(true);
    expect(isNavItemVisible({ audience: "bureau" }, bureauPro)).toBe(true);
    expect(canOpenProSpace({ ...bureauPro, rolesReady: true })).toBe(true);
  });
  it("un pro n'obtient pas les entrées Bureau / Paramètres", () => {
    expect(isNavItemVisible({ audience: "bureau" }, pro)).toBe(false);
  });
  it("les réservations du terrain sont fermées aux particuliers et aux pros, gérées par le Bureau", () => {
    expect(canBookTerrain(particulier)).toBe(false);
    expect(canBookTerrain(pro)).toBe(false);
    expect(canBookTerrain(bureau)).toBe(true);
  });
  it("le profil reste dans l'espace personnel pour tous", () => {
    expect(memberHubTabFor("/profile")).toBe("/profile");
    expect(isNavItemVisible({ audience: "all" }, bureau)).toBe(true);
  });
});
