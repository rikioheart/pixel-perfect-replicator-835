import { describe, expect, it } from "vitest";
import { contributionBucket, priorityOf, sortGov, terrainBucket, type GovItem } from "./governance";

const today = "2026-10-23";

describe("besoins de décision du Bureau", () => {
  it("un sujet en attente depuis 14 jours devient prioritaire, pas à 13 jours", () => {
    expect(priorityOf({ bucket: "decide", since: "2026-10-09" }, today)).toBe("URGENTE");
    expect(priorityOf({ bucket: "decide", since: "2026-10-10" }, today)).toBe("NORMALE");
  });
  it("une échéance à 7 jours ou moins rend la décision prioritaire", () => {
    expect(priorityOf({ bucket: "decide", since: today, due: "2026-10-30" }, today)).toBe("URGENTE");
    expect(priorityOf({ bucket: "decide", since: today, due: "2026-10-31" }, today)).toBe("NORMALE");
  });
  it("un suivi n'est prioritaire que si son échéance est dépassée", () => {
    expect(priorityOf({ bucket: "followup", since: "2026-01-01", due: "2026-10-24" }, today)).toBe("NORMALE");
    expect(priorityOf({ bucket: "followup", since: today, due: "2026-10-22" }, today)).toBe("URGENTE");
  });
  it("les contributions sont classées sans recopier leur statut", () => {
    expect(contributionBucket("PROPOSED")).toBe("decide");
    expect(contributionBucket("BLOCKED")).toBe("arbitrage");
    expect(contributionBucket("IN_PROGRESS")).toBe("followup");
    expect(contributionBucket("COMPLETED")).toBeNull();
  });
  it("une réservation acceptée passée sort du suivi", () => {
    expect(terrainBucket("APPROVED", "2026-10-22", today)).toBeNull();
    expect(terrainBucket("APPROVED", today, today)).toBe("followup");
    expect(terrainBucket("PENDING", "2026-01-01", today)).toBe("decide");
  });
  it("les sujets urgents passent en tête", () => {
    const base = { source: "s", title: "t", state: "x", action: "a", link: "/" } as const;
    const items: GovItem[] = [
      { ...base, key: "recent", bucket: "decide", since: today },
      { ...base, key: "ancien", bucket: "decide", since: "2026-09-01" },
    ];
    expect(sortGov(items, today).map((i) => i.key)).toEqual(["ancien", "recent"]);
  });
});
