import { describe, expect, it } from "vitest";
import { canPublishToNews, teamCanEditCommunication, milestoneState, sortMilestones, taskCounts } from "./project-followup";

describe("jalons", () => {
  it("un jalon atteint reste atteint même en retard", () => {
    expect(milestoneState({ id: "1", title: "a", due_date: "2020-01-01", done_at: "2020-02-01" }, "2026-01-01")).toBe("DONE");
  });
  it("date dépassée non atteinte = en retard", () => {
    expect(milestoneState({ id: "1", title: "a", due_date: "2025-12-31", done_at: null }, "2026-01-01")).toBe("LATE");
  });
  it("sans date = à venir", () => {
    expect(milestoneState({ id: "1", title: "a", due_date: null, done_at: null }, "2026-01-01")).toBe("UPCOMING");
  });
  it("tri chronologique, sans date en dernier", () => {
    const r = sortMilestones([
      { id: "a", title: "z", due_date: null, done_at: null },
      { id: "b", title: "b", due_date: "2026-05-01", done_at: null },
      { id: "c", title: "c", due_date: "2026-03-01", done_at: null },
    ]);
    expect(r.map((m) => m.id)).toEqual(["c", "b", "a"]);
  });
});

describe("compteur de tâches par projet", () => {
  it("annulées exclues, terminées comptées à part", () => {
    const m = taskCounts([
      { project_id: "p", status: "TODO" },
      { project_id: "p", status: "COMPLETED" },
      { project_id: "p", status: "CANCELLED" },
      { project_id: null, status: "TODO" },
    ]);
    expect(m.get("p")).toEqual({ open: 1, done: 1 });
    expect(m.size).toBe(1);
  });
});

describe("communication Bureau", () => {
  it("publication dans Actualités seulement après validation du Bureau, une seule fois", () => {
    expect(canPublishToNews({ status: "READY" })).toBe(true);
    expect(canPublishToNews({ status: "IN_REVIEW" })).toBe(false);
    expect(canPublishToNews({ status: "DRAFT" })).toBe(false);
    expect(canPublishToNews({ status: "READY", published_update_id: "u1" })).toBe(false);
  });
  it("l'équipe ne modifie plus une communication validée", () => {
    expect(teamCanEditCommunication("DRAFT")).toBe(true);
    expect(teamCanEditCommunication("IN_REVIEW")).toBe(true);
    expect(teamCanEditCommunication("READY")).toBe(false);
    expect(teamCanEditCommunication("ARCHIVED")).toBe(false);
  });
});
