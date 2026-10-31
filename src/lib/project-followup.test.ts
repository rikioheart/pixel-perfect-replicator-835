import { describe, expect, it } from "vitest";
import { canRelayToWall, milestoneState, sortMilestones, taskCounts } from "./project-followup";

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
  it("relais vers Nos avancées seulement si prête et canal interne", () => {
    expect(canRelayToWall({ status: "READY", channel: "INTERNAL_WALL" })).toBe(true);
    expect(canRelayToWall({ status: "DRAFT", channel: "INTERNAL_WALL" })).toBe(false);
    expect(canRelayToWall({ status: "READY", channel: "SOCIAL_POST" })).toBe(false);
  });
});
