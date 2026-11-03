/**
 * Historique unifié (/admin/audit) : catégorisation des actions réellement écrites dans audit_logs
 * (déclencheurs et RPC) et des événements d'intégration HelloAsso (integration_events).
 * Aucune table parallèle : simple lecture et classement côté interface.
 */

export const AUDIT_CATEGORIES = {
  MEMBRES: "Adhésions & Membres",
  FINANCES: "Finances",
  PROJETS: "Projets & Tâches",
  CHIENS: "Chiens & Foyers",
  HABILITATIONS: "Habilitations",
  FIDELITE: "Fidélité",
  AUTRE: "Paramétrage & autres",
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;

const RULES: [AuditCategory, string[]][] = [
  // Ordre important : ACCOUNTING doit passer avant ACCOUNT.
  ["FINANCES", ["FINANCE", "ACCOUNTING", "REIMBURSEMENT"]],
  ["MEMBRES", ["MEMBERSHIP", "MEMBER_LEVEL", "ACCOUNT", "INTEGRATION."]],
  ["PROJETS", ["PROJECT.", "TASK", "MILESTONE"]],
  ["CHIENS", ["DOG", "HOUSEHOLD"]],
  ["HABILITATIONS", ["ROLE.", "FUNCTION.", "PERMISSION_", "DELEGATION_", "PASS_VALIDATOR"]],
  ["FIDELITE", ["LOYALTY", "PASS_"]],
];

/** Catégorie d'une action ; une annulation (.undo) suit l'action d'origine ; inconnu → AUTRE. */
export function auditCategory(action: string): AuditCategory {
  const base = action.replace(/\.undo$/i, "").toUpperCase();
  for (const [cat, prefixes] of RULES) if (prefixes.some((p) => base.startsWith(p))) return cat;
  return "AUTRE";
}

const LABELS: Record<string, string> = {
  "project.create": "Création de projet",
  "project.update": "Modification de projet",
  "project.delete": "Suppression de projet",
  "project.link": "Rattachement de projet",
  "task.create": "Création de tâche",
  "task.update": "Modification de tâche",
  "task.status": "Changement de statut de tâche",
  "task.link": "Rattachement de tâche",
  TASK_VALIDATED: "Tâche validée",
  TASK_RETURNED: "Tâche renvoyée",
  TASK_REOPENED: "Tâche rouverte",
  "role.assign": "Attribution de rôle",
  "role.revoke": "Retrait de rôle",
  "function.assign": "Attribution de fonction",
  "function.revoke": "Clôture de fonction",
  PERMISSION_GRANTED: "Permission accordée",
  PERMISSION_REVOKED: "Permission retirée",
  DELEGATION_CREATE: "Délégation créée",
  DELEGATION_REVOKE: "Délégation retirée",
  PASS_VALIDATOR_ON: "Valideur Pass activé",
  PASS_VALIDATOR_OFF: "Valideur Pass désactivé",
  PASS_PERSONAL_ON: "Pass personnel activé",
  PASS_PERSONAL_OFF: "Pass personnel désactivé",
  LOYALTY_MANUAL_STAMP: "Tampon manuel",
  LOYALTY_OFFLINE_MEDIATION: "Médiation hors réseau",
  LOYALTY_RULE_CREATED: "Règle de fidélité créée",
  LOYALTY_RULE_UPDATED: "Règle de fidélité modifiée",
  LOYALTY_RULE_DELETED: "Règle de fidélité supprimée",
  DOG_ACCESS_SHARED: "Dossier chien partagé",
  DOG_ACCESS_UPDATED: "Partage de dossier chien modifié",
  DOG_ACCESS_REVOKED: "Partage de dossier chien retiré",
  MEMBER_LEVEL_UPDATED: "Niveau de membre modifié",
  "membership.update": "Adhésion modifiée",
  "membership.active": "Adhésion validée",
  "membership.refused": "Adhésion refusée",
  "account.choice": "Choix du parcours",
  "account.closed_by_bureau": "Compte clôturé par le Bureau",
  "account.deleted": "Compte supprimé",
  "account.deletion_blocked": "Suppression de compte en attente",
  CONFIG_OPTION_CREATED: "Référentiel : option créée",
  CONFIG_OPTION_UPDATED: "Référentiel : option modifiée",
  CONFIG_OPTION_DELETED: "Référentiel : option supprimée",
  "action.undo": "Annulation d'action",
};

const OUTCOME: Record<string, string> = {
  CREATED: "adhésion créée",
  UPDATED: "adhésion mise à jour",
  UNCHANGED: "déjà connue",
  TO_REVIEW: "à valider",
  PERSON_ONLY: "personne sans compte",
  ERROR: "erreur",
  RESOLVED: "traité",
  EXPORTED: "exporté",
};

/** Libellé lisible ; repli : préfixe et suffixe humanisés, jamais de valeur brute de payload. */
export function auditLabel(action: string): string {
  if (LABELS[action]) return LABELS[action];
  if (action.toLowerCase().startsWith("integration.")) {
    const outcome = action.slice("integration.".length).toUpperCase();
    return `Import HelloAsso — ${OUTCOME[outcome] ?? outcome.toLowerCase()}`;
  }
  const undo = /\.undo$/i.test(action);
  const base = action.replace(/\.undo$/i, "");
  const known = LABELS[base];
  const text = known ?? base.replace(/[._]+/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return undo ? `Annulation — ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

export type UnifiedSource = "AUDIT" | "HELLOASSO";
export const SOURCE_LABEL: Record<UnifiedSource, string> = {
  AUDIT: "Journal plateforme",
  HELLOASSO: "HelloAsso",
};
