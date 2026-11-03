/**
 * Annuaire — sources autorisées pour les fiches chiens.
 * Jamais de lecture directe de public.dogs pour les chiens d'autres personnes :
 * - foyer : chiens des foyers dont l'utilisateur est membre (useMyHouseholds, filtré par household_id + RLS) ;
 * - pro   : get_pro_dogs() (accès partagés + vue opérationnelle) ;
 * - bureau: bureau_dogs() (rubriques privées masquées selon dogs.read_sensitive).
 */
export type DogSource = "household" | "pro" | "bureau";

export function dogSourcesFor({ isBureau, isPro }: { isBureau: boolean; isPro: boolean }): DogSource[] {
  const sources: DogSource[] = ["household"];
  if (isPro) sources.push("pro");
  if (isBureau) sources.push("bureau");
  return sources;
}

export const DOG_SOURCE_LABEL: Record<DogSource, string> = {
  household: "Mon foyer",
  pro: "Chiens accompagnés",
  bureau: "Registre du Bureau",
};
