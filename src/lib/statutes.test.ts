import { describe, expect, it } from "vitest";
import { convocationDeadline, isInAgMonth, nextAgYear, quorumReached } from "./statutes";

describe("repères statutaires de l'AG", () => {
  it("convocation au plus tard 15 jours avant", () => {
    expect(convocationDeadline("2027-06-20")).toBe("2027-06-05");
    expect(convocationDeadline("2027-06-10")).toBe("2027-05-26");
  });
  it("AG ordinaire en juin", () => {
    expect(isInAgMonth("2027-06-15")).toBe(true);
    expect(isInAgMonth("2027-07-01")).toBe(false);
  });
  it("quorum de 8 personnes", () => {
    expect(quorumReached(7)).toBe(false);
    expect(quorumReached(8)).toBe(true);
  });
  it("prochaine AG l'année suivante une fois juin passé", () => {
    expect(nextAgYear(new Date(Date.UTC(2026, 9, 11)))).toBe(2027);
    expect(nextAgYear(new Date(Date.UTC(2026, 2, 1)))).toBe(2026);
  });
});
