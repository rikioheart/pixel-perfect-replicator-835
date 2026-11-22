import { filterByName } from "@/lib/name-search";

/**
 * Qualités d'une personne dans le sélecteur de membres. Une personne peut en cumuler plusieurs
 * (ex. pro + Bureau + représentant). Elles sont calculées par la base (picker_people) à partir
 * des rôles, du type d'adhésion et des fonctions associatives actives.
 */
export const QUALITIES = ["BUREAU", "PRO", "PARTICULIER", "BENEVOLE", "REPRESENTANT", "PARTENAIRE"] as const;
export type Quality = (typeof QUALITIES)[number];

export const QUALITY_LABEL: Record<Quality, string> = {
  BUREAU: "Bureau",
  PRO: "Professionnel",
  PARTICULIER: "Particulier",
  BENEVOLE: "Bénévole",
  REPRESENTANT: "Représentant",
  PARTENAIRE: "Partenaire",
};

export type MemberOption = {
  id: string;
  name: string;
  company: string | null;
  qualities: Quality[];
};

/** Garde seulement les qualités connues, dans l'ordre d'affichage. */
export function normalizeQualities(values: readonly string[] | null | undefined): Quality[] {
  const set = new Set(values ?? []);
  return QUALITIES.filter((q) => set.has(q));
}

/**
 * Filtre combinable : aucune qualité choisie = tout le monde ; sinon une personne apparaît
 * dès qu'elle a au moins une des qualités choisies. La recherche porte sur le nom et la structure.
 */
export function filterMembers(members: MemberOption[], qualities: readonly Quality[], search: string): MemberOption[] {
  const byQuality = qualities.length === 0 ? members : members.filter((m) => m.qualities.some((q) => qualities.includes(q)));
  const withText = byQuality.map((m) => ({ member: m, name: `${m.name} ${m.company ?? ""}` }));
  return filterByName(withText, search).map((x) => x.member);
}

/** Qualités présentes dans la liste (on n'affiche pas un filtre qui ne trouverait personne). */
export function availableQualities(members: MemberOption[]): Quality[] {
  const present = new Set(members.flatMap((m) => m.qualities));
  return QUALITIES.filter((q) => present.has(q));
}
