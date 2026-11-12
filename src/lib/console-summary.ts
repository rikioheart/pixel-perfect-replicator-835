/**
 * Synthèse de la Console du Bureau : uniquement des compteurs, pourcentages et totaux
 * renvoyés par bureau_console_summary(). Aucune ligne nominative n'arrive dans le navigateur.
 */
export type ConsoleSummary = {
  members: { active: number; activeParticuliers: number; activePros: number; pending: number; considered: number };
  tasks: { working: number; assigned: number; overdue: number; toValidate: number; needsHelp: number; peopleInvolved: number };
  offers: number;
  proProposals: number;
  inventory: { lowStock: number; overdueLoans: number };
  ag: { title: string; counted: number } | null;
  /** null = aucun droit financier ; un champ null = droit absent pour cette source. */
  finance: {
    reimbPendingCount: number | null;
    reimbPendingAmount: number | null;
    reimbApprovedAmount: number | null;
    payoutsDueAmount: number | null;
  } | null;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => (v == null ? null : num(v));

/** Ne conserve que les champs connus (liste blanche) : tout autre champ est ignoré. */
export function parseConsoleSummary(raw: unknown): ConsoleSummary {
  const r = obj(raw);
  const m = obj(r["members"]);
  const t = obj(r["tasks"]);
  const i = obj(r["inventory"]);
  const ag = r["ag"] == null ? null : obj(r["ag"]);
  const f = r["finance"] == null ? null : obj(r["finance"]);
  return {
    members: {
      active: num(m["active"]),
      activeParticuliers: num(m["active_particuliers"]),
      activePros: num(m["active_pros"]),
      pending: num(m["pending"]),
      considered: num(m["considered"]),
    },
    tasks: {
      working: num(t["working"]),
      assigned: num(t["assigned"]),
      overdue: num(t["overdue"]),
      toValidate: num(t["to_validate"]),
      needsHelp: num(t["needs_help"]),
      peopleInvolved: num(t["people_involved"]),
    },
    offers: num(r["offers"]),
    proProposals: num(r["pro_proposals"]),
    inventory: { lowStock: num(i["low_stock"]), overdueLoans: num(i["overdue_loans"]) },
    ag: ag ? { title: typeof ag["title"] === "string" ? ag["title"] : "Assemblée générale", counted: num(ag["counted"]) } : null,
    finance: f
      ? {
          reimbPendingCount: numOrNull(f["reimb_pending_count"]),
          reimbPendingAmount: numOrNull(f["reimb_pending_amount"]),
          reimbApprovedAmount: numOrNull(f["reimb_approved_amount"]),
          payoutsDueAmount: numOrNull(f["payouts_due_amount"]),
        }
      : null,
  };
}

/** Pourcentage arrondi (0–100) ; null quand il n'y a rien à rapporter (évite un faux 0 %). */
export function pct(part: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export type Tone = "ok" | "warn" | "alert" | "calm";

/** Statut synthétique des tâches en cours, selon la part en retard. */
export function taskStatus(tasks: ConsoleSummary["tasks"]): { label: string; tone: Tone } {
  if (tasks.working === 0) return { label: "Aucune tâche en cours", tone: "calm" };
  const late = pct(tasks.overdue, tasks.working) ?? 0;
  if (late === 0) return { label: "Dans les temps", tone: "ok" };
  if (late < 25) return { label: "Quelques retards", tone: "warn" };
  return { label: "Retards à traiter", tone: "alert" };
}

/** Statut synthétique des adhésions. */
export function membershipStatus(members: ConsoleSummary["members"]): { label: string; tone: Tone } {
  if (members.pending > 0) return { label: "Adhésions en attente", tone: "warn" };
  if (members.considered === 0) return { label: "Aucune adhésion", tone: "calm" };
  return { label: "À jour", tone: "ok" };
}
