export const NOTIFICATION_TYPES = [
  "TASK_SUBMITTED",
  "TASK_VALIDATED",
  "TASK_REJECTED",
  "VOLUNTEER_REQUEST",
  "VOLUNTEER_ASSIGNED",
  "PROPOSAL_SUBMITTED",
  "PROPOSAL_ACCEPTED",
  "PROPOSAL_REJECTED",
  "EVENT_UPDATED",
  "EVENT_REGISTRATION",
  "LOYALTY_STAMP",
  "TERRAIN_REQUEST",
  "TERRAIN_APPROVED",
  "CONTRACT_UPDATED",
  "REIMBURSEMENT_REQUESTED",
  "REIMBURSEMENT_VALIDATED",
  "SYSTEM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const LABELS: Record<string, string> = {
  TASK_SUBMITTED: "Tâche soumise",
  TASK_VALIDATED: "Tâche validée",
  TASK_REJECTED: "Tâche refusée",
  TASK_PENDING_VALIDATION: "Tâche à valider",
  TASK_APPROVED: "Tâche validée",
  VOLUNTEER_REQUEST: "Appel à bénévole",
  VOLUNTEER_ASSIGNED: "Bénévole assigné",
  PROPOSAL_SUBMITTED: "Proposition reçue",
  PROPOSAL_ACCEPTED: "Proposition acceptée",
  PROPOSAL_REJECTED: "Proposition refusée",
  EVENT_UPDATED: "Événement mis à jour",
  EVENT_REGISTRATION: "Inscription à un événement",
  LOYALTY_STAMP: "Tampon de fidélité",
  TERRAIN_REQUEST: "Demande de terrain",
  TERRAIN_APPROVED: "Terrain accordé",
  CONTRACT_UPDATED: "Contrat mis à jour",
  REIMBURSEMENT_REQUESTED: "Remboursement demandé",
  REIMBURSEMENT_VALIDATED: "Remboursement validé",
  SYSTEM: "Système",
};

export function notificationLabel(kind: string): string {
  return LABELS[kind] ?? kind;
}
