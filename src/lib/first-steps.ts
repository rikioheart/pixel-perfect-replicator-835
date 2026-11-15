/**
 * Parcours « Mon premier chien » du nouvel adhérent particulier.
 * L'affichage se déduit uniquement des données réelles (chien enregistré) :
 * rien n'est stocké en plus, sauf le choix « Plus tard » mémorisé sur l'appareil.
 *
 * - « full »     : l'invitation complète avec le formulaire ouvert ;
 * - « reminder » : après « Plus tard », un rappel discret qui permet de rouvrir le formulaire ;
 * - « hidden »   : dès que le premier chien est enregistré (ou si la personne n'est pas concernée).
 */

export type FirstStepsInput = {
  isParticulier: boolean;
  membershipStatus: string | null | undefined;
  dogCount: number;
  dismissed: boolean;
};

export type FirstStepsDisplay = "full" | "reminder" | "hidden";

export type FirstStepsState = {
  display: FirstStepsDisplay;
  visible: boolean;
  dogDone: boolean;
};

export function firstStepsState(input: FirstStepsInput): FirstStepsState {
  const dogDone = input.dogCount > 0;
  const concerned = input.isParticulier && input.membershipStatus === "ACTIVE";
  const display: FirstStepsDisplay = !concerned || dogDone ? "hidden" : input.dismissed ? "reminder" : "full";
  return { display, visible: display !== "hidden", dogDone };
}

export function firstStepsStorageKey(userId: string): string {
  return `lvdc:first-steps-dismissed:${userId}`;
}

/** Nom de foyer proposé quand le premier chien est présenté sans foyer existant. */
export function defaultHouseholdName(firstName: string | null | undefined): string {
  const name = (firstName ?? "").replace(/\s+/g, " ").trim();
  return name.length >= 1 ? `Foyer de ${name}`.slice(0, 60) : "Mon foyer";
}
