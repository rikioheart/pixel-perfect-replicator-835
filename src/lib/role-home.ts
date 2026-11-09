/**
 * Accueils par rôle : où chacun arrive après connexion, et ce qui attend une action humaine.
 * Fonctions pures, sans accès aux données : la base (RLS) reste la seule frontière de sécurité.
 */

export type RoleFlags = { isBureau: boolean; isPro: boolean };

/** Page d'arrivée : Bureau → console, pro validé → espace pro, sinon accueil membre. */
export function homePathFor({ isBureau, isPro }: RoleFlags): "/admin" | "/espace-pro" | "/member" {
  if (isBureau) return "/admin";
  if (isPro) return "/espace-pro";
  return "/member";
}

export type PendingAction = {
  key: string;
  label: string;
  count: number | null;
  to: string;
  search?: Record<string, string> | undefined;
};

/**
 * Actions en attente, dans l'ordre d'urgence donné, sans les compteurs nuls.
 * null = information indisponible (droits ou chargement) : jamais affiché comme « rien à faire ».
 */
export function pendingActions(items: PendingAction[]): PendingAction[] {
  return items.filter((item) => item.count === null || item.count > 0);
}

/** Une réservation de matériel est en retard si elle est encore en cours après sa date de fin. */
export function isOverdueReservation(r: { status: string; end_date: string | null }, today: string): boolean {
  return r.status === "ACTIVE" && Boolean(r.end_date) && (r.end_date as string) < today;
}

export const REX_FIELDS = [
  { value: "rex_successes", label: "Ce qui a bien fonctionné" },
  { value: "rex_improvements", label: "Ce que nous ferions autrement" },
  { value: "rex_advice", label: "Conseils pour la prochaine fois" },
] as const;
export type RexField = (typeof REX_FIELDS)[number]["value"];

/** Le retour d'expérience depuis une tâche : seulement une tâche validée, rattachée à un projet, par un responsable. */
export function canAddTaskRex(task: { status: string; project_id?: string | null }, canValidate: boolean): boolean {
  return task.status === "COMPLETED" && Boolean(task.project_id) && canValidate;
}
