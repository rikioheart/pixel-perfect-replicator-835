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
};

export const MEMBER_FUNCTION_LABEL: Record<string, string> = {
  FOUNDER: "Fondateur",
  PRESIDENT: "Président",
  SECRETARY: "Secrétaire",
  TREASURER: "Trésorier",
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
