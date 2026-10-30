export const MEMBERSHIP_TYPE_LABEL: Record<string, string> = {
  PARTICULIER: "Particulier",
  PROFESSIONNEL: "Professionnel",
  BUREAU: "Bureau",
  BENEVOLE: "Bénévole",
  PARTENAIRE: "Partenaire",
};

export const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  INACTIVE: "Inactif",
  REFUSED: "Non retenue",
  EXCLUDED: "Radié·e",
};

/**
 * Catégories statutaires (article 5 des statuts). Indépendantes des fonctions :
 * un fondateur ou un bienfaiteur peut aussi être au Bureau ou représentant,
 * un membre actif peut aussi être bénévole.
 */
export const STATUTORY_CATEGORIES = ["FONDATEUR", "ACTIF", "BIENFAITEUR", "APPRENANT", "SOUTIEN"] as const;

export const STATUTORY_CATEGORY_LABEL: Record<string, string> = {
  FONDATEUR: "Membre fondateur",
  ACTIF: "Membre actif / adhérent",
  BIENFAITEUR: "Membre bienfaiteur",
  APPRENANT: "Membre apprenant",
  SOUTIEN: "Membre soutien",
};

export const MEMBER_FUNCTION_LABEL: Record<string, string> = {
  FOUNDER: "Fondateur",
  BUREAU: "Membre du Bureau",
  PRESIDENT: "Président",
  SECRETARY: "Secrétaire",
  TREASURER: "Trésorier",
  REPRESENTANT_PRO: "Représentant des membres professionnels",
  REPRESENTANT_PARTICULIER: "Représentant des membres particuliers",
  COORDINATOR: "Coordinateur",
  REFERENT: "Référent",
  VOLUNTEER: "Bénévole",
};

export function memberFullName(member: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const composed = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
  return member.display_name?.trim() || composed || member.email || "Membre sans nom";
}
