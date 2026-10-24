/** Le choix du parcours n'est proposé qu'une fois, aux comptes en attente qui ne l'ont pas encore fait. */
export function needsAccountChoice(
  profile: { membership_status?: string | null; account_choice_at?: string | null; deleted_at?: string | null } | null | undefined,
): boolean {
  if (!profile || profile.deleted_at) return false;
  return profile.membership_status === "PENDING" && !profile.account_choice_at;
}

/** SIRET facultatif ; s'il est saisi : 14 chiffres (espaces tolérés). */
export function isValidSiret(value: string): boolean {
  const v = value.replace(/\s/g, "");
  return v === "" || /^\d{14}$/.test(v);
}

export type DeletionBlockers = { projects: { id: string; title: string }[]; reimbursements: number };

export function hasDeletionBlockers(b: DeletionBlockers | null | undefined): boolean {
  return !!b && (b.projects.length > 0 || b.reimbursements > 0);
}
