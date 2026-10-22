/** Cycle de vie des remboursements, aligné sur le contrôle en base (guard_reimbursement). */
export type ReimbursementStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export const REIMBURSEMENT_LABEL: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée, à payer",
  REJECTED: "Refusée",
  REFUSED: "Refusée",
  PAID: "Payée",
};

/** Actions possibles pour le Bureau selon le statut actuel. Jamais de paiement sans approbation. */
export function nextReimbursementActions(status: string): ReimbursementStatus[] {
  if (status === "PENDING") return ["APPROVED", "REJECTED"];
  if (status === "APPROVED") return ["PAID", "REJECTED"];
  return [];
}

/** Un membre du Bureau ne traite jamais sa propre demande. */
export function canProcessReimbursement(viewerId: string | undefined, personId: string, isBureau: boolean) {
  return isBureau && !!viewerId && viewerId !== personId;
}

export type ReimbursementSummary = { pending: number; approved: number; paid: number; rejected: number };

/** Totaux distincts par statut : les montants en attente ne sont jamais additionnés aux montants payés. */
export function summarizeReimbursements(rows: { amount: number | string | null; status: string }[]): ReimbursementSummary {
  const s: ReimbursementSummary = { pending: 0, approved: 0, paid: 0, rejected: 0 };
  for (const r of rows) {
    const cents = Math.round(Number(r.amount ?? 0) * 100);
    if (r.status === "PENDING") s.pending += cents;
    else if (r.status === "APPROVED") s.approved += cents;
    else if (r.status === "PAID") s.paid += cents;
    else if (r.status === "REJECTED" || r.status === "REFUSED") s.rejected += cents;
  }
  return { pending: s.pending / 100, approved: s.approved / 100, paid: s.paid / 100, rejected: s.rejected / 100 };
}

export const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export type MemberBalance = { personId: string; pending: number; toPay: number; paid: number };

/** Solde par membre : en attente, approuvé restant à payer, déjà payé (refus exclus). Trié par reste à payer. */
export function balancesByMember(rows: { person_id: string; amount: number | string | null; status: string }[]): MemberBalance[] {
  const map = new Map<string, { pending: number; toPay: number; paid: number }>();
  for (const r of rows) {
    const c = Math.round(Number(r.amount ?? 0) * 100);
    const b = map.get(r.person_id) ?? { pending: 0, toPay: 0, paid: 0 };
    if (r.status === "PENDING") b.pending += c;
    else if (r.status === "APPROVED") b.toPay += c;
    else if (r.status === "PAID") b.paid += c;
    map.set(r.person_id, b);
  }
  return [...map.entries()]
    .map(([personId, b]) => ({ personId, pending: b.pending / 100, toPay: b.toPay / 100, paid: b.paid / 100 }))
    .filter((b) => b.pending || b.toPay || b.paid)
    .sort((a, b) => b.toPay - a.toPay || b.pending - a.pending);
}

/** Reversement pro : payé si une date de reversement est enregistrée par le Bureau. */
export const payoutLabel = (paidAt: string | null | undefined) => (paidAt ? "Payé" : "À payer");

export function summarizePayouts(rows: { professional_share: number | string | null; professional_paid_at: string | null }[]) {
  let paid = 0, due = 0;
  for (const r of rows) {
    const c = Math.round(Number(r.professional_share ?? 0) * 100);
    if (r.professional_paid_at) paid += c; else due += c;
  }
  return { paid: paid / 100, due: due / 100 };
}
