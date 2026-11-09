/** Suivi de projet (Bloc A) : jalons datés, comptage des tâches, communications Bureau. Logique pure, testée. */

export type Milestone = { id: string; title: string; due_date: string | null; done_at: string | null };
export type MilestoneState = "DONE" | "LATE" | "UPCOMING";

export function milestoneState(m: Milestone, today = new Date().toISOString().slice(0, 10)): MilestoneState {
  if (m.done_at) return "DONE";
  if (m.due_date && m.due_date < today) return "LATE";
  return "UPCOMING";
}

/** Ordre chronologique : datés d'abord (croissant), sans date à la fin. */
export function sortMilestones<T extends Milestone>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.title.localeCompare(b.title);
  });
}

const CLOSED = new Set(["COMPLETED", "DONE", "VALIDATED", "ARCHIVED", "CANCELLED"]);
export function taskCounts(tasks: { project_id: string | null; status: string }[]) {
  const map = new Map<string, { open: number; done: number }>();
  for (const t of tasks) {
    if (!t.project_id) continue;
    const c = map.get(t.project_id) ?? { open: 0, done: 0 };
    if (t.status === "CANCELLED") continue;
    if (CLOSED.has(t.status)) c.done += 1;
    else c.open += 1;
    map.set(t.project_id, c);
  }
  return map;
}

export const COMM_STATUSES: [string, string][] = [
  ["DRAFT", "Brouillons"],
  ["IN_REVIEW", "À valider"],
  ["READY", "Validées par le Bureau"],
  ["ARCHIVED", "Diffusées / archivées"],
];
export const COMM_CHANNELS: [string, string][] = [
  ["INTERNAL_WALL", "Actualités (interne)"],
  ["EMAIL_INFO", "E-mail d'information"],
  ["TERRAIN_DISPLAY", "Affichage terrain"],
  ["SOCIAL_POST", "Réseaux sociaux"],
  ["PRESS_MAIRIE", "Presse / mairies"],
];
export const COMM_AUDIENCES: [string, string][] = [
  ["ALL_MEMBERS", "Tous les membres"],
  ["PROS", "Professionnels"],
  ["VOLUNTEERS", "Bénévoles"],
  ["BUREAU", "Bureau"],
  ["PUBLIC", "Grand public"],
];

/** Publication dans « Actualités » : seulement après validation du Bureau, une seule fois (contrôlé aussi par publish_communication). */
export function canPublishToNews(c: { status: string; published_update_id?: string | null }) {
  return c.status === "READY" && !c.published_update_id;
}

/** L'équipe du projet rédige et soumet ; une fois validée, seule le Bureau modifie (garde guard_bureau_communication). */
export function teamCanEditCommunication(status: string) {
  return status === "DRAFT" || status === "IN_REVIEW";
}
