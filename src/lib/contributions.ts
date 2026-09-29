export const CONTRIBUTION_TYPES: [string, string][] = [
  ["TEMPS", "Donner un peu de temps"],
  ["PONCTUEL", "Aide ponctuelle"],
  ["COMPETENCE", "Une compétence"],
  ["MISE_EN_RELATION", "Mise en relation"],
  ["IDEE", "Une idée"],
  ["TERRAIN", "Action terrain"],
  ["REFERENT", "Devenir référent"],
];
export const CONTRIBUTION_TYPE_LABEL = Object.fromEntries(CONTRIBUTION_TYPES) as Record<string, string>;

export const CONTRIBUTION_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Proposée",
  DISCUSSION: "En discussion",
  ACCEPTED: "Acceptée",
  IN_PROGRESS: "En cours",
  BLOCKED: "Bloquée",
  COMPLETED: "Réalisée",
  CANCELLED: "Annulée",
};

export const TIME_OPTIONS = ["Une heure", "Une demi-journée", "Quelques heures par mois", "Régulièrement", "Je ne sais pas encore"];

export const UPDATE_KINDS: [string, string][] = [
  ["PROJET", "Projet qui avance"],
  ["ACTION", "Action réalisée"],
  ["PARTENARIAT", "Partenariat"],
  ["ACTIVITE", "Activité"],
  ["EVENEMENT", "Événement"],
  ["BESOIN", "Besoin d'aide"],
  ["RESULTAT", "Résultat concret"],
];
export const UPDATE_KIND_LABEL = Object.fromEntries(UPDATE_KINDS) as Record<string, string>;
