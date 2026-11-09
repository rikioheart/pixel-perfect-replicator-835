/**
 * Droits par défaut des rôles système. La base reste la source réelle
 * (role_permissions) ; ce référentiel sert à repérer les écarts et à rétablir un rôle.
 */

export const SYSTEM_ROLE_ORDER = [
  "ADMIN_BUREAU",
  "MEMBRE_FONDATEUR",
  "MEMBRE_BIENFAITEUR",
  "MEMBRE_APPRENANT",
  "MEMBRE_SOUTIEN",
  "PARTICULIER",
  "REPRESENTANT_PARTICULIERS",
] as const;

export const ROLE_SHORT_LABEL: Record<string, string> = {
  ADMIN_BUREAU: "Bureau",
  MEMBRE_FONDATEUR: "Fondateur",
  MEMBRE_BIENFAITEUR: "Bienfaiteur",
  MEMBRE_APPRENANT: "Apprenant",
  MEMBRE_SOUTIEN: "Soutien",
  PARTICULIER: "Particulier",
  REPRESENTANT_PARTICULIERS: "Repr. particuliers",
};

/** Socle commun à tout membre : consulter, participer, gérer son profil et ses frais. */
export const MEMBER_BASE = [
  "activities.propose",
  "activities.view",
  "documents.view",
  "events.view",
  "finance.view_own",
  "loyalty.view_own",
  "mindmap.view",
  "partners.view",
  "profiles.update_own",
  "profiles.view_others",
  "profiles.view_own",
  "projects.view",
  "reimbursements.create",
  "reimbursements.view",
  "tasks.submit",
  "tasks.update",
  "tasks.view",
  "terrain.view",
] as const;

/** Droits professionnels portés par le rôle Bienfaiteur, effectifs seulement pour un pro validé. */
export const PRO_ONLY = [
  "activities.create",
  "documents.upload",
  "loyalty.stamp",
  "members.view",
  "terrain.reserve",
] as const;

/** Animation de la vie associative (fondateurs, représentants). La mindmap reste modifiable par le seul Bureau. */
const ANIMATION = [
  "audit.view",
  "documents.upload",
  "members.view",
  "projects.create",
  "projects.update",
  "settings.view",
  "tasks.assign",
  "tasks.create",
] as const;

export type DefaultGrant = { code: string; requiresProfessional: boolean };

/** Droits par défaut d'un rôle ; `null` = tous les droits (Bureau). */
export function defaultGrantsFor(roleCode: string): DefaultGrant[] | null {
  const plain = (codes: readonly string[]) => codes.map((code) => ({ code, requiresProfessional: false }));
  switch (roleCode) {
    case "ADMIN_BUREAU":
      return null;
    case "MEMBRE_FONDATEUR":
    case "REPRESENTANT_PARTICULIERS":
      return plain([...MEMBER_BASE, ...ANIMATION]);
    case "MEMBRE_BIENFAITEUR":
      return [
        ...plain(MEMBER_BASE),
        ...PRO_ONLY.map((code) => ({ code, requiresProfessional: true })),
      ];
    case "MEMBRE_APPRENANT":
    case "MEMBRE_SOUTIEN":
    case "PARTICULIER":
      return plain(MEMBER_BASE);
    default:
      return [];
  }
}

/** Écart entre l'état réel d'une case et le défaut du rôle. */
export function defaultState(roleCode: string, permissionCode: string): "granted" | "pro" | "none" {
  const grants = defaultGrantsFor(roleCode);
  if (grants === null) return "granted";
  const grant = grants.find((g) => g.code === permissionCode);
  if (!grant) return "none";
  return grant.requiresProfessional ? "pro" : "granted";
}

export function sortRoles<T extends { code: string }>(roles: T[]): T[] {
  const rank = (code: string) => {
    const i = (SYSTEM_ROLE_ORDER as readonly string[]).indexOf(code);
    return i === -1 ? SYSTEM_ROLE_ORDER.length : i;
  };
  return [...roles].sort((a, b) => rank(a.code) - rank(b.code));
}
