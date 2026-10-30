/** Personnes du foyer sans compte : libellés, âge calculé, foyer principal. */
export const RELATION_LABEL: Record<string, string> = {
  ENFANT: "Enfant",
  CONJOINT: "Conjoint·e",
  PARENT: "Parent",
  AUTRE: "Autre proche",
};

/** Âge en années révolues à partir de la date de naissance (ou de l'ancienne année seule). */
export function ageFrom(birthDate: string | null | undefined, birthYear?: number | null, today = new Date()): number | null {
  if (birthDate) {
    const b = new Date(`${birthDate}T00:00:00`);
    if (Number.isNaN(b.getTime())) return null;
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age -= 1;
    return age >= 0 ? age : null;
  }
  if (birthYear) return Math.max(0, today.getFullYear() - birthYear);
  return null;
}

export function personLabel(p: { first_name: string; last_name?: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}

/** Un seul foyer par membre : les membres présents dans plusieurs foyers sont à régulariser. */
export function membersInSeveralHouseholds(rows: { user_id: string; household_id: string }[]) {
  const count = new Map<string, Set<string>>();
  for (const r of rows) count.set(r.user_id, (count.get(r.user_id) ?? new Set()).add(r.household_id));
  return new Set([...count].filter(([, s]) => s.size > 1).map(([u]) => u));
}

/** Nom de foyer : « Mon foyer » (neutre, par défaut) ou « Foyer de [Prénom] » si le prénom est connu. */
export function householdNameOptions(firstName: string | null | undefined): string[] {
  const first = (firstName ?? "").trim();
  return first ? ["Mon foyer", `Foyer de ${first}`] : ["Mon foyer"];
}

/** Nom saisi nettoyé (espaces, 60 caractères) ; null si trop court pour être reconnaissable. */
export function cleanHouseholdName(name: string): string | null {
  const v = name.replace(/\s+/g, " ").trim().slice(0, 60);
  return v.length >= 2 ? v : null;
}

/** Clôture par le Bureau : motif d'au moins 5 caractères et mot « CLÔTURER » (avec ou sans accent). */
export function canSubmitAccountClosure(reason: string, confirm: string): boolean {
  const word = confirm.trim().toUpperCase();
  return reason.trim().length >= 5 && (word === "CLÔTURER" || word === "CLOTURER");
}
