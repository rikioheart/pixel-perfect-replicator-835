import { describe, expect, it } from "vitest";
import { isNavItemPrimary, isNavItemVisible, memberHubTabFor } from "./nav-rules";

const particulier = { isBureau: false, isPro: false };
const pro = { isBureau: false, isPro: true };
const bureau = { isBureau: true, isPro: false };

describe("navigation par rôle", () => {
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
});
