/**
 * Messages destinés aux personnes : courts, en français, sans jargon technique.
 * Le détail technique reste dans la console (journal), jamais dans le message affiché.
 */

export const GENERIC_ERROR = "Cela n'a pas fonctionné cette fois-ci. Réessayez dans un instant ; si cela continue, le Bureau peut vous aider.";

/**
 * Message de secours bienveillant pour une action précise, sans jargon :
 * couldNot("enregistrer vos changements") → « Nous n'avons pas pu enregistrer vos changements pour le moment. Réessayez dans un instant. »
 */
export function couldNot(action: string): string {
  return `Nous n'avons pas pu ${action.trim()} pour le moment. Réessayez dans un instant.`;
}

/** Refus de droits, dit avec douceur et une piste pour avancer. */
export const NOT_ALLOWED = "Cette action est réservée à d'autres responsables. Si vous en avez besoin, le Bureau peut vous aider.";

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown } | string | null | undefined;

/** Traductions des erreurs techniques courantes (base, authentification, réseau). */
const KNOWN: Array<[test: (msg: string, code: string) => boolean, text: string]> = [
  [(m) => /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(m),
    "La connexion semble coupée pour le moment. Vérifiez votre réseau, puis réessayez."],
  [(m) => /timeout|timed out|statement timeout/i.test(m), "Le serveur prend un peu de temps à répondre. Patientez un instant, puis réessayez."],
  [(m, c) => c === "PGRST301" || /jwt expired|invalid jwt|refresh token|session (not found|missing|expired)|auth session missing/i.test(m),
    "Par sécurité, votre session s'est terminée. Reconnectez-vous pour reprendre là où vous en étiez."],
  [(m) => /invalid login credentials/i.test(m), "E-mail ou mot de passe incorrect. Vérifiez-les, ou utilisez « Mot de passe oublié ? »."],
  [(m) => /email not confirmed/i.test(m), "Il reste une petite étape : confirmez votre adresse grâce au lien reçu par e-mail."],
  [(m) => /already registered|user already exists/i.test(m),
    "Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez votre mot de passe."],
  [(m) => /should be different from the old password|same_password/i.test(m),
    "Ce mot de passe est celui que vous utilisez déjà. Choisissez-en un nouveau."],
  [(m) => /pwned|known to be weak|easy to guess|leaked/i.test(m),
    "Ce mot de passe apparaît dans des fuites connues. Choisissez-en un autre, plus personnel."],
  [(m) => /password should be at least|password is too short|weak password/i.test(m),
    "Ce mot de passe est un peu court ou trop simple. Choisissez-en un plus long."],
  [(m) => /unable to validate email|invalid format|email address .* is invalid/i.test(m), "Cette adresse e-mail ne semble pas complète. Pouvez-vous la vérifier ?"],
  [(m, c) => c === "429" || /rate limit|too many requests|for security purposes, you can only request/i.test(m),
    "Pour votre sécurité, patientez quelques instants avant de réessayer."],
  [(m, c) => c === "42501" || /row-level security|permission denied|not authorized|unauthorized|forbidden/i.test(m),
    NOT_ALLOWED],
  [(m, c) => c === "23505" || /duplicate key/i.test(m), "C'est déjà enregistré : inutile de le refaire."],
  [(m, c) => c === "23503" || /foreign key/i.test(m), "Cet élément est lié à d'autres informations, il ne peut donc pas être modifié ainsi. Le Bureau peut vous aider si besoin."],
  [(m, c) => c === "23502" || /null value in column|violates not-null/i.test(m), "Il manque une information obligatoire. Vérifiez les champs, puis réessayez."],
  [(m, c) => c === "23514" || /violates check constraint/i.test(m), "Une des valeurs saisies n'est pas acceptée. Pouvez-vous la vérifier ?"],
  [(m, c) => c === "22007" || c === "22008" || /invalid input syntax for type (date|timestamp)/i.test(m), "La date saisie ne semble pas valide. Pouvez-vous la vérifier ?"],
  [(m, c) => c === "22P02" || /invalid input syntax/i.test(m), "Une valeur saisie n'a pas le format attendu. Pouvez-vous la vérifier ?"],
  [(m, c) => c === "PGRST116" || /no rows|0 rows|not found/i.test(m), "Nous ne trouvons pas cet élément : il a peut-être été retiré, ou il ne vous est pas accessible."],
  [(m) => /payload too large|file size|exceeded the maximum/i.test(m), "Ce fichier est un peu trop lourd. Essayez avec une version plus légère."],
];

const ENGLISH = /\b(the|failed|error|invalid|violates|denied|cannot|could|unable|column|relation|function|does|exist|exists|unexpected|request|undefined|not|found|missing|required|must|should|please|only|expired|exceeded|limit|already|user|value|key|of|for|to|is|are|with)\b/i;
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
  // Phrase courte sans aucun marqueur anglais ni code technique (ex. « Indiquez le motif. ») : déjà rédigée pour la personne.
  if (!known && trimmed && !code && !ENGLISH.test(trimmed) && !/[_{}()[\]<>]|\d{3,}/.test(trimmed)) return trimmed;
  if (typeof console !== "undefined" && (trimmed || code)) console.warn("[erreur technique]", code || "-", trimmed);
  return known ? known[1] : fallback;
}
