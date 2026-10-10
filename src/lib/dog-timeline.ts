/** Carnet de vie du chien : uniquement des événements du chien (jamais l'adhésion de l'humain). */
export type TimelineItem = {
  key: string;
  kind: "OUTING" | "GOAL" | "OBSERVATION";
  title: string;
  date: string;
  detail?: string | undefined;
  upcoming?: boolean | undefined;
};

export const INDICATOR_FAMILY_LABEL: Record<string, string> = {
  VERT: "🟢 À l'aise",
  JAUNE: "🟡 Attention douce",
  BLEU: "🔵 Besoin particulier",
  NOIR: "⚫ À éviter",
};

const GOAL_STATUS: Record<string, string> = { DONE: "atteint", COMPLETED: "atteint", IN_PROGRESS: "en cours", TODO: "à venir" };

export function buildDogTimeline(
  input: {
    observations: { id: string; body: string; created_at: string }[];
    goals: { id: string; title: string; status: string; created_at: string }[];
    outings: { id: string; title: string; date: string; status: string }[];
  },
  now: Date = new Date(),
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...input.outings
      .filter((o) => o.status !== "CANCELLED")
      .map((o) => ({ key: `o-${o.id}`, kind: "OUTING" as const, title: o.title, date: o.date, upcoming: new Date(o.date) > now })),
    ...input.goals.map((g) => ({
      key: `g-${g.id}`, kind: "GOAL" as const, title: `Objectif : ${g.title}`, date: g.created_at,
      detail: GOAL_STATUS[g.status] ?? undefined,
    })),
    ...input.observations.map((o) => ({
      key: `b-${o.id}`, kind: "OBSERVATION" as const, title: "Observation partagée", date: o.created_at,
      detail: o.body.length > 90 ? `${o.body.slice(0, 90)}…` : o.body,
    })),
  ];
  // À venir d'abord (le plus proche en tête), puis le passé du plus récent au plus ancien.
  const up = items.filter((i) => i.upcoming).sort((a, b) => a.date.localeCompare(b.date));
  const past = items.filter((i) => !i.upcoming).sort((a, b) => b.date.localeCompare(a.date));
  return [...up, ...past];
}

export function dogAge(birth: string | null, now: Date = new Date()): string | null {
  if (!birth) return null;
  const b = new Date(birth);
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 12) return `${months} mois`;
  const y = Math.floor(months / 12);
  return `${y} an${y > 1 ? "s" : ""}`;
}

/** Libellé de rôle : dépend du statut réel de la personne, jamais d'une tâche. */
export function memberRoleLabel(v: { isBureau: boolean; isPro: boolean }): string {
  if (v.isBureau) return "Bureau";
  if (v.isPro) return "Professionnel adhérent";
  return "Adhérent";
}
