/**
 * Messages destinés aux personnes : courts, en français, sans jargon technique.
 * Le détail technique reste dans la console (journal), jamais dans le message affiché.
 */

export const GENERIC_ERROR = "Cette action n'a pas abouti. Réessayez dans un instant.";

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown } | string | null | undefined;

/** Traductions des erreurs techniques courantes (base, authentification, réseau). */
const KNOWN: Array<[test: (msg: string, code: string) => boolean, text: string]> = [
  [(m) => /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(m),
    "Connexion impossible pour le moment. Vérifiez votre réseau, puis réessayez."],
  [(m) => /timeout|timed out|statement timeout/i.test(m), "Le serveur met trop de temps à répondre. Réessayez dans un instant."],
  [(m, c) => c === "PGRST301" || /jwt expired|invalid jwt|refresh token|session (not found|missing|expired)|auth session missing/i.test(m),
    "Votre session a expiré. Reconnectez-vous pour continuer."],
  [(m) => /invalid login credentials/i.test(m), "E-mail ou mot de passe incorrect."],
  [(m) => /email not confirmed/i.test(m), "Confirmez d'abord votre adresse e-mail (lien reçu par e-mail)."],
  [(m) => /already registered|user already exists/i.test(m),
    "Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez votre mot de passe."],
  [(m) => /password should be at least|password is too short|weak password/i.test(m),
    "Ce mot de passe est trop court ou trop simple. Choisissez-en un plus long."],
  [(m) => /unable to validate email|invalid format|email address .* is invalid/i.test(m), "Cette adresse e-mail ne semble pas valide."],
  [(m, c) => c === "429" || /rate limit|too many requests|for security purposes, you can only request/i.test(m),
    "Pour votre sécurité, patientez quelques instants avant de réessayer."],
  [(m, c) => c === "42501" || /row-level security|permission denied|not authorized|unauthorized|forbidden/i.test(m),
    "Vous n'avez pas l'autorisation de faire cette action."],
  [(m, c) => c === "23505" || /duplicate key/i.test(m), "Cet élément existe déjà."],
  [(m, c) => c === "23503" || /foreign key/i.test(m), "Cet élément est relié à d'autres informations : il ne peut pas être modifié ainsi."],
  [(m, c) => c === "23502" || /null value in column|violates not-null/i.test(m), "Un champ obligatoire n'est pas rempli."],
  [(m, c) => c === "23514" || /violates check constraint/i.test(m), "Une des valeurs saisies n'est pas acceptée."],
  [(m, c) => c === "22007" || c === "22008" || /invalid input syntax for type (date|timestamp)/i.test(m), "La date saisie n'est pas valide."],
  [(m, c) => c === "22P02" || /invalid input syntax/i.test(m), "Une valeur saisie n'a pas le bon format."],
  [(m, c) => c === "PGRST116" || /no rows|0 rows|not found/i.test(m), "Élément introuvable, ou il ne vous est pas accessible."],
  [(m) => /payload too large|file size|exceeded the maximum/i.test(m), "Ce fichier est trop volumineux."],
];

const ENGLISH = /\b(the|failed|error|invalid|violates|denied|cannot|could not|unable|column|relation|function|does not|exist|unexpected|request|null|undefined|is not)\b/i;
const FRENCH = /[àâçéèêëîïôûùœ]|\b(vous|votre|impossible|veuillez|seul|seule|pas|une|des|est|cette|ce|déjà)\b/i;

/** Un message rédigé en français (par exemple levé par une règle de la base) est montré tel quel. */
export function isFrenchMessage(message: string): boolean {
  return FRENCH.test(message) && !ENGLISH.test(message);
}

/**
 * Transforme une erreur en phrase lisible. Les messages métier déjà en français sont conservés ;
 * les erreurs techniques (souvent en anglais) sont traduites, ou remplacées par `fallback`.
 */
export function humanizeError(error: unknown, fallback: string = GENERIC_ERROR): string {
  const e = error as ErrorLike;
  const message = typeof e === "string" ? e : typeof e?.message === "string" ? e.message : "";
  const code = typeof e === "object" && e ? String(e.code ?? e.status ?? "") : "";
  const trimmed = message.trim();
  if (trimmed && isFrenchMessage(trimmed)) return trimmed;
  const known = KNOWN.find(([test]) => test(trimmed, code));
  if (typeof console !== "undefined" && (trimmed || code)) console.warn("[erreur technique]", code || "-", trimmed);
  return known ? known[1] : fallback;
}
