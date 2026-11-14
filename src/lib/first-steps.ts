/**
 * Parcours « Mon premier chien » du nouvel adhérent particulier.
 * L'étape se déduit uniquement des données réelles (chien enregistré) :
 * rien n'est stocké en plus, sauf le choix « Plus tard » mémorisé sur l'appareil.
 */

export type FirstStepsInput = {
  isParticulier: boolean;
  membershipStatus: string | null | undefined;
  dogCount: number;
  dismissed: boolean;
};

export type FirstStepsState = {
  visible: boolean;
  dogDone: boolean;
  doneCount: number;
  total: number;
};

export function firstStepsState(input: FirstStepsInput): FirstStepsState {
  const dogDone = input.dogCount > 0;
  const doneCount = Number(dogDone);
  const visible =
    input.isParticulier && input.membershipStatus === "ACTIVE" && !input.dismissed && doneCount < 1;
  return { visible, dogDone, doneCount, total: 1 };
}

export function firstStepsStorageKey(userId: string): string {
  return `lvdc:first-steps-dismissed:${userId}`;
}

/** Nom de foyer proposé quand le premier chien est présenté sans foyer existant. */
export function defaultHouseholdName(firstName: string | null | undefined): string {
  const name = (firstName ?? "").replace(/\s+/g, " ").trim();
  return name.length >= 1 ? `Foyer de ${name}`.slice(0, 60) : "Mon foyer";
}
