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


export const MEMBER_FUNCTION_LABEL: Record<string, string> = {
  FOUNDER: "Fondateur",
  BUREAU: "Membre du Bureau",
  PRESIDENT: "Président",
  SECRETARY: "Secrétaire",
  TREASURER: "Trésorier",
  REPRESENTANT_PRO: "Représentant des professionnels",
  REPRESENTANT_PARTICULIER: "Représentant des particuliers",
  COORDINATOR: "Coordinateur",
  REFERENT: "Référent",
  VOLUNTEER: "Bénévole",
};

/**
 * Fonctions associatives attribuables depuis « Rôles & habilitations ».
 * Coordinateur et Référent restent des responsabilités de projet (attribuées depuis le projet) ;
 * « Membre du Bureau » est un rôle système, plus une fonction.
 */
export const ASSOCIATION_FUNCTIONS = [
  "FOUNDER",
  "PRESIDENT",
  "SECRETARY",
  "TREASURER",
  "REPRESENTANT_PRO",
  "REPRESENTANT_PARTICULIER",
  "VOLUNTEER",
] as const;

/** Une seule personne à la fois (garanti aussi par la base). */
export const UNIQUE_FUNCTIONS = ["PRESIDENT", "SECRETARY", "TREASURER"];

/** Responsabilités liées à un projet, visibles mais gérées depuis le projet. */
export const PROJECT_FUNCTIONS = ["COORDINATOR", "REFERENT"];

export function memberFullName(member: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const composed = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
  return member.display_name?.trim() || composed || member.email || "Membre sans nom";
}
