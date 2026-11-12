import { describe, expect, it } from "vitest";
import { membershipStatus, parseConsoleSummary, pct, taskStatus } from "./console-summary";

const tasks = { working: 4, assigned: 3, overdue: 0, toValidate: 0, needsHelp: 0, peopleInvolved: 2 };

describe("console-summary", () => {
  it("calcule un pourcentage arrondi", () => {
    expect(pct(3, 4)).toBe(75);
    expect(pct(1, 3)).toBe(33);
  });

  it("ne renvoie pas de faux 0 % quand il n'y a rien à rapporter", () => {
    expect(pct(0, 0)).toBeNull();
  });

  it("ignore tout champ nominatif inattendu renvoyé par la base", () => {
    const parsed = parseConsoleSummary({
      members: { active: 4, pending: 1, considered: 5, names: ["Alice"] },
      tasks: { working: 2, assignees: ["u1"] },
      people: [{ id: "u1", email: "a@b.fr" }],
    });
    expect(Object.keys(parsed.members).sort()).toEqual(["active", "activeParticuliers", "activePros", "considered", "pending"]);
    expect(parsed).not.toHaveProperty("people");
    expect(parsed.tasks).not.toHaveProperty("assignees");
  });

  it("masque la synthèse financière sans droit financier", () => {
    expect(parseConsoleSummary({ finance: null }).finance).toBeNull();
    expect(parseConsoleSummary({ finance: { reimb_pending_count: 2, payouts_due_amount: null } }).finance).toEqual({
      reimbPendingCount: 2,
      reimbPendingAmount: null,
      reimbApprovedAmount: null,
      payoutsDueAmount: null,
    });
  });

  it("donne un statut de tâches selon la part en retard", () => {
    expect(taskStatus({ ...tasks, working: 0 }).tone).toBe("calm");
    expect(taskStatus(tasks).tone).toBe("ok");
    expect(taskStatus({ ...tasks, working: 10, overdue: 2 }).tone).toBe("warn");
    expect(taskStatus({ ...tasks, working: 4, overdue: 1 }).tone).toBe("alert");
  });

  it("signale les adhésions en attente", () => {
    expect(membershipStatus({ active: 4, activeParticuliers: 2, activePros: 2, pending: 1, considered: 5 }).tone).toBe("warn");
    expect(membershipStatus({ active: 4, activeParticuliers: 2, activePros: 2, pending: 0, considered: 4 }).tone).toBe("ok");
  });
});
