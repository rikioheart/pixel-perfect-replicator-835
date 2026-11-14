/**
 * Démonstration sécurisée du parcours « Mon premier chien & sortie ».
 * Tout se passe en mémoire, avec un compte d'essai fictif : aucune lecture ni écriture
 * dans la base, aucun compte créé. Fermer la démonstration efface tout.
 */
import { dogNameProblem, firstStepsState, type DogDraft, type FirstStepsState } from "./first-steps";

export const DEMO_PERSONA = { firstName: "Camille", label: "Compte d'essai fictif" } as const;

export const DEMO_ACTIVITY = {
  id: "demo",
  title: "Balade découverte en forêt (exemple)",
  date: null as string | null,
  location: "Lieu fictif",
};

export type DemoState = {
  dogs: { id: string; name: string; breed: string | null; birth_date: string | null }[];
  householdCreated: boolean;
  registered: boolean;
  dismissed: boolean;
};

export function initialDemo(): DemoState {
  return { dogs: [], householdCreated: false, registered: false, dismissed: false };
}

export type DemoResult = { ok: true; state: DemoState } | { ok: false; message: string };

export function demoAddDog(state: DemoState, draft: DogDraft): DemoResult {
  const problem = dogNameProblem(draft.name);
  if (problem) return { ok: false, message: problem };
  const dog = {
    id: `demo-dog-${state.dogs.length + 1}`,
    name: draft.name.trim(),
    breed: draft.breed.trim() || null,
    birth_date: draft.birth_date || null,
  };
  return { ok: true, state: { ...state, dogs: [...state.dogs, dog], householdCreated: true } };
}

/** Comme dans l'inscription réelle, un chien doit être présenté avant de l'inscrire avec lui. */
export function demoRegister(state: DemoState): DemoResult {
  if (state.dogs.length === 0) {
    return { ok: false, message: "Présentez d'abord votre compagnon pour l'inscrire avec vous." };
  }
  return { ok: true, state: { ...state, registered: true } };
}

/** Le compte d'essai est un particulier à l'adhésion active : mêmes règles que pour un vrai membre. */
export function demoStepsState(state: DemoState): FirstStepsState {
  return firstStepsState({
    isParticulier: true,
    membershipStatus: "ACTIVE",
    dogCount: state.dogs.length,
    outingCount: state.registered ? 1 : 0,
    dismissed: state.dismissed,
  });
}
