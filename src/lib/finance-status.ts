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
