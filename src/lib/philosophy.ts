export type Principle = {
  title: string;
  body: string;
  /** Comment la plateforme traduit ce principe concrètement. */
  concrete: string;
};

export const PRINCIPLES: Principle[] = [
  {
    title: "Nous travaillons ensemble",
    body: "Aucun projet n'appartient à une seule personne : l'équipe est visible sur chaque projet.",
    concrete: "Équipes de projet, mindmap partagée et journal commun.",
  },
  {
    title: "Nous avançons progressivement",
    body: "Un grand chantier se découpe en petits progrès atteignables.",
    concrete: "Sous-projets, sous-tâches et pourcentage d'avancement.",
  },
  {
    title: "Chaque personne contribue à son niveau",
    body: "Une heure ou dix heures, une compétence ou un coup de main : tout compte.",
    concrete: "Tâches bénévoles ouvertes, niveau d'implication au profil.",
  },
  {
    title: "Chaque action importante est visible",
    body: "Ce qui est fait ne se perd pas dans les conversations.",
    concrete: "Journal d'activité horodaté et notifications en temps réel.",
  },
  {
    title: "Chaque contribution peut être reconnue",
    body: "La reconnaissance fait partie du fonctionnement, pas d'un bonus.",
    concrete: "Validations du Bureau, historique personnel, carte de fidélité.",
  },
  {
    title: "Les responsabilités sont claires",
    body: "On sait qui porte quoi, et qui contacter en cas de doute.",
    concrete: "Rôles, fonctions associatives et référent par projet.",
  },
  {
    title: "Les validations sont traçables",
    body: "Une décision se lit : qui, quand, pourquoi.",
    concrete: "File de validation, preuves déposées, motifs de retour.",
  },
  {
    title: "Les projets restent accessibles",
    body: "Personne ne doit demander l'autorisation pour comprendre où en est l'association.",
    concrete: "Projets visibles par défaut à toute l'association.",
  },
  {
    title: "Les blocages s'identifient sans culpabiliser",
    body: "Signaler un blocage est un service rendu au collectif, jamais un aveu d'échec.",
    concrete: "Bouton « J'ai besoin d'aide » sur chaque tâche, sans pénalité.",
  },
  {
    title: "Coopérer, pas administrer",
    body: "La plateforme ne doit jamais ajouter de la lourdeur au bénévolat.",
    concrete: "Formulaires courts, saisie facultative, tout est réversible.",
  },
];

export const CHARTER_TAGLINE =
  "Ensemble, progressivement, chacun à son niveau — et rien ne se perd.";
