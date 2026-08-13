export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "WAITING",
  "PENDING_VALIDATION",
  "COMPLETED",
  "BLOCKED",
  "CANCELLED",
  "ARCHIVED",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  WAITING: "En attente",
  PENDING_VALIDATION: "À valider",
  COMPLETED: "Terminée",
  BLOCKED: "Bloquée",
  CANCELLED: "Annulée",
  ARCHIVED: "Archivée",
};

export const PROJECT_STATUSES = [
  "PLANNED",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
] as const;

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planifié",
  ACTIVE: "Actif",
  ON_HOLD: "En pause",
  COMPLETED: "Terminé",
  ARCHIVED: "Archivé",
};

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export const PROJECT_ROLES = [
  "OWNER",
  "COORDINATOR",
  "CONTRIBUTOR",
  "VOLUNTEER",
  "EXPERT",
  "REVIEWER",
] as const;

export const PROJECT_ROLE_LABEL: Record<string, string> = {
  OWNER: "Responsable",
  COORDINATOR: "Coordinateur",
  CONTRIBUTOR: "Contributeur",
  VOLUNTEER: "Bénévole",
  EXPERT: "Expert",
  REVIEWER: "Relecteur",
};

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
