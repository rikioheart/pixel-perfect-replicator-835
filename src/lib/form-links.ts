/** Lien externe de formulaire (ex. Google Forms) : https uniquement, sans identifiants. */
export function isSafeExternalFormUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Indique si le lien vise Google Forms (affichage uniquement). */
export function isGoogleFormUrl(raw: string): boolean {
  if (!isSafeExternalFormUrl(raw)) return false;
  const h = new URL(raw).hostname;
  return h === "forms.gle" || (h === "docs.google.com" && new URL(raw).pathname.startsWith("/forms"));
}
