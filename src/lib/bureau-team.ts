/**
 * Règles du Bureau partagées entre « Rôles & habilitations », l'annuaire et la navigation.
 * L'interface ne fait que guider : la base reste la frontière de sécurité (RLS, is_bureau).
 */

/** Fonctions exécutives (uniques) : Président, Secrétaire, Trésorier. */
export const EXECUTIVE_FUNCTIONS = ["PRESIDENT", "SECRETARY", "TREASURER"] as const;

export const isExecutiveFunction = (type: string) =>
  (EXECUTIVE_FUNCTIONS as readonly string[]).includes(type);

/** Une fonction exécutive attribuée entraîne le rôle Bureau, s'il manque. */
export function needsBureauRole(functionType: string, roleCodes: string[]): boolean {
  return isExecutiveFunction(functionType) && !roleCodes.includes("ADMIN_BUREAU");
}

/** Raison pour laquelle le rôle Bureau ne peut pas être retiré (anti-lockout), sinon null. */
export function bureauRevokeBlock(opts: { bureauCount: number; isSelf: boolean }): string | null {
  if (opts.bureauCount <= 1)
    return "C'est le dernier membre du Bureau : son rôle Bureau doit être conservé pour que l'association garde un accès d'administration.";
  if (opts.isSelf) return "Vous ne pouvez pas retirer votre propre rôle Bureau.";
  return null;
}

/** Message à afficher après tout changement de rôle ou de fonction. */
export const reconnectHint = (name: string) =>
  `Prévenez ${name} : ses nouveaux accès seront pris en compte après reconnexion (ou en rechargeant la page).`;

type ActiveFunction = { user_id: string; function_type: string; scope_type?: string | null };

/** Équipe du Bureau : rôle Bureau ou fonction exécutive active (jamais « Fondateur » seul). */
export function bureauTeamIds(bureauIds: string[], functions: ActiveFunction[]): Set<string> {
  const ids = new Set(bureauIds);
  for (const f of functions) {
    if ((f.scope_type ?? "ASSOCIATION") === "ASSOCIATION" && isExecutiveFunction(f.function_type))
      ids.add(f.user_id);
  }
  return ids;
}

/** Raccourci « Comptabilité & Grand livre » : trésorier membre du Bureau. */
export function showTreasurerShortcut(opts: { isBureau: boolean; functionTypes: string[] }): boolean {
  return opts.isBureau && opts.functionTypes.includes("TREASURER");
}
