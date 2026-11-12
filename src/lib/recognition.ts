/**
 * Petites marques de reconnaissance : calculées à la volée à partir de décisions humaines déjà
 * enregistrées (aucun stockage, aucun compteur, aucun classement), visibles seulement par la personne.
 */
export type BadgeCode = "PREMIER_COUP_DE_MAIN" | "BIENFAITEUR_ACTIF";

export const BADGES: Record<BadgeCode, { label: string; message: string; criterion: string }> = {
  PREMIER_COUP_DE_MAIN: {
    label: "Premier coup de main",
    message: "Une tâche que vous avez portée a été validée par l'équipe. Merci d'avoir mis la main à la pâte !",
    criterion: "Une tâche qui vous était confiée a été validée par une autre personne (coordinateur du projet ou Bureau).",
  },
  BIENFAITEUR_ACTIF: {
    label: "Bienfaiteur actif",
    message: "Le Bureau vous compte parmi les membres bienfaiteurs. Merci pour votre soutien à l'association.",
    criterion: "Le Bureau vous a attribué le rôle « Membre bienfaiteur » et votre adhésion est active.",
  },
};

/** Conçu mais non attribué : aucune donnée existante ne le prouve sans un critère décidé par le Bureau. */
export const DESIGN_ONLY_BADGES = [
  {
    label: "Pilier du terrain",
    why: "Les présences validées (tampons du Pass Terrain, présences enregistrées sur les activités) existent, mais ce qui fait un « pilier » (nombre, période, types de sorties) n'a pas été décidé. Rien n'est attribué tant que le Bureau n'a pas fixé ce critère.",
  },
] as const;

export type RecognitionInput = {
  /** Tâches qui vous étaient confiées, terminées et validées par quelqu'un d'autre que vous. */
  tasksValidatedByOthers: number;
  roles: string[];
  membershipStatus: string | null | undefined;
};

export function earnedBadges(input: RecognitionInput): BadgeCode[] {
  const out: BadgeCode[] = [];
  if (input.tasksValidatedByOthers > 0) out.push("PREMIER_COUP_DE_MAIN");
  if (input.membershipStatus === "ACTIVE" && input.roles.includes("MEMBRE_BIENFAITEUR")) out.push("BIENFAITEUR_ACTIF");
  return out;
}

/** Nouveau tampon confirmé par le serveur depuis le dernier passage sur cet appareil (jamais à la première lecture). */
export function isNewStamp(previous: string | null, current: number): boolean {
  if (previous === null) return false;
  const prev = Number(previous);
  return Number.isFinite(prev) && current > prev;
}
