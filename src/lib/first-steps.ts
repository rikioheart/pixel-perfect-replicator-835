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

/** Une inscription annulée ou refusée ne compte pas comme « première sortie ». */
const NOT_COUNTED = new Set(["ANNULE", "CANCELLED", "REFUSE", "REFUSED"]);

export function countOutings(statuses: Array<string | null | undefined>): number {
  return statuses.filter((s) => !NOT_COUNTED.has(String(s ?? "").toUpperCase())).length;
}

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

export type DogDraft = { name: string; breed: string; birth_date: string };

/** Message bienveillant si le nom du compagnon est trop court, sinon null. */
export function dogNameProblem(name: string): string | null {
  return name.trim().length < 2 ? "Indiquez le nom de votre compagnon (2 lettres au moins)." : null;
}
