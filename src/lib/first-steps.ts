/**
 * Parcours « Mon premier chien & sortie » du nouvel adhérent particulier.
 * Les étapes se déduisent uniquement des données réelles (chien enregistré, inscription à une sortie) :
 * rien n'est stocké en plus, sauf le choix « Plus tard » mémorisé sur l'appareil.
 */

export type FirstStepsInput = {
  isParticulier: boolean;
  membershipStatus: string | null | undefined;
  dogCount: number;
  outingCount: number;
  dismissed: boolean;
};

export type FirstStepsState = {
  visible: boolean;
  dogDone: boolean;
  outingDone: boolean;
  doneCount: number;
  total: number;
};

/** Statuts d'inscription qui comptent comme « première sortie » (une annulation ne compte pas). */
export const COUNTED_OUTING_STATUSES = ["PENDING", "REGISTERED", "CONFIRMED", "WAITLIST", "ATTENDED"] as const;

export function firstStepsState(input: FirstStepsInput): FirstStepsState {
  const dogDone = input.dogCount > 0;
  const outingDone = input.outingCount > 0;
  const doneCount = Number(dogDone) + Number(outingDone);
  const visible =
    input.isParticulier && input.membershipStatus === "ACTIVE" && !input.dismissed && doneCount < 2;
  return { visible, dogDone, outingDone, doneCount, total: 2 };
}

export function firstStepsStorageKey(userId: string): string {
  return `lvdc:first-steps-dismissed:${userId}`;
}

/** Nom de foyer proposé quand le premier chien est présenté sans foyer existant. */
export function defaultHouseholdName(firstName: string | null | undefined): string {
  const name = (firstName ?? "").replace(/\s+/g, " ").trim();
  return name.length >= 1 ? `Foyer de ${name}`.slice(0, 60) : "Mon foyer";
}
