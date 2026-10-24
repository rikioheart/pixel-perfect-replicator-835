/** Terminé = statut COMPLETED/CANCELLED, ou date de fin (sinon de début) passée. Rien n'est supprimé. */
export function isPast(
  item: { status?: string | null; date?: string | null; start_date?: string | null; end_date?: string | null },
  now: Date = new Date(),
): boolean {
  if (item.status === "COMPLETED" || item.status === "CANCELLED" || item.status === "ARCHIVED") return true;
  const ref = item.end_date ?? item.date ?? item.start_date;
  if (!ref) return false;
  const d = new Date(ref);
  // Un rendez-vous reste « en cours » toute la journée où il a lieu.
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return endOfDay < now;
}

export function splitArchive<T extends Parameters<typeof isPast>[0]>(items: T[], now: Date = new Date()) {
  const current: T[] = [];
  const past: T[] = [];
  for (const i of items) (isPast(i, now) ? past : current).push(i);
  return { current, past: past.reverse() };
}

/** Avancement opérationnel : part des tâches terminées parmi les tâches éligibles (annulées/refusées exclues), poids égal. */
export function operationalProgress(tasks: { status: string }[]): number | null {
  const eligible = tasks.filter((t) => t.status !== "CANCELLED" && t.status !== "REJECTED");
  if (eligible.length === 0) return null;
  const done = eligible.filter((t) => t.status === "COMPLETED" || t.status === "VALIDATED").length;
  return Math.round((done / eligible.length) * 100);
}
