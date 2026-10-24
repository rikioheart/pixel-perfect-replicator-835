/** Partage du dossier d'un chien avec un ou plusieurs professionnels : règles d'affichage côté interface.
 * La sécurité réelle reste dans la base (share_dog_access_many / update_dog_access / revoke_dog_access). */

export const SHARE_SECTIONS = [
  ["can_identity", "Identité"],
  ["can_info", "Informations"],
  ["can_goals", "Objectifs"],
  ["can_activities", "Activités"],
  ["can_observations", "Observations"],
] as const;

export type ShareKey = (typeof SHARE_SECTIONS)[number][0];
export type SharePerms = Record<ShareKey, boolean>;

export const NO_PERMS: SharePerms = {
  can_identity: false, can_info: false, can_goals: false, can_activities: false, can_observations: false,
};

/** Formules prêtes à l'emploi : le propriétaire peut toujours ajuster rubrique par rubrique. */
export const SHARE_PRESETS: { id: string; label: string; hint: string; perms: SharePerms }[] = [
  {
    id: "pratique", label: "Fiche pratique", hint: "Pour une sortie ou une garde ponctuelle",
    perms: { ...NO_PERMS, can_identity: true, can_info: true },
  },
  {
    id: "accompagnement", label: "Accompagnement", hint: "Pour un éducateur ou un suivi régulier",
    perms: { ...NO_PERMS, can_identity: true, can_info: true, can_goals: true, can_activities: true },
  },
  {
    id: "complet", label: "Suivi complet", hint: "Avec les observations partagées",
    perms: { can_identity: true, can_info: true, can_goals: true, can_activities: true, can_observations: true },
  },
];

export type AccessRow = SharePerms & {
  id: string;
  professional_id: string;
  revoked: boolean;
  expires_at: string | null;
  source_access_id?: string | null;
};

export function isAccessActive(a: Pick<AccessRow, "revoked" | "expires_at">, now: Date = new Date()): boolean {
  if (a.revoked) return false;
  return !a.expires_at || new Date(a.expires_at) > now;
}

export function activeAccesses<T extends AccessRow>(rows: T[], now: Date = new Date()): T[] {
  return rows.filter((a) => isAccessActive(a, now));
}

export function sectionsSummary(a: SharePerms): string {
  return SHARE_SECTIONS.filter(([k]) => a[k]).map(([, l]) => l).join(", ") || "Aucune rubrique";
}

export function hasAnySection(p: SharePerms): boolean {
  return SHARE_SECTIONS.some(([k]) => p[k]);
}

/** Professionnels déjà servis : on ne les propose pas une seconde fois dans la liste de partage. */
export function availablePros<T extends { id: string }>(pros: T[], rows: AccessRow[], now: Date = new Date()): T[] {
  const taken = new Set(activeAccesses(rows, now).map((a) => a.professional_id));
  return pros.filter((p) => !taken.has(p.id));
}

export function shareResultMessage(res: { shared: string[]; skipped: string[] }, nameOf: (id: string) => string): string {
  const parts: string[] = [];
  if (res.shared.length === 1) parts.push(`Dossier ouvert à ${nameOf(res.shared[0]!)}.`);
  else if (res.shared.length > 1) parts.push(`Dossier ouvert à ${res.shared.length} professionnels.`);
  if (res.skipped.length) {
    parts.push(`Déjà partagé avec ${res.skipped.map(nameOf).join(", ")} : modifiez son accès si besoin.`);
  }
  return parts.join(" ") || "Aucun partage effectué.";
}

export const INDICATOR_CATEGORY_LABEL: Record<string, string> = {
  INTERACTION_CHIEN: "Avec les autres chiens",
  INTERACTION_HUMAIN: "Avec les humains",
  ESPACE: "Espace",
  APPROCHE: "Approche",
  ENVIRONNEMENT: "Environnement",
  BESOIN_SPECIFIQUE: "Besoin spécifique",
};
