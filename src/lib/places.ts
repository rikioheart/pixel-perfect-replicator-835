/** Lien Google Maps (recherche) pour une adresse ou un lieu saisi librement. */
export function mapsUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.trim())}`;
}

/** Fiche Google Business : uniquement des liens HTTPS Google (évite toute redirection piégée). */
export function safeGoogleBusinessUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return null;
    const h = u.hostname.toLowerCase();
    const ok = h === "g.page" || h === "maps.app.goo.gl" || h === "goo.gl" || /(^|\.)google\.[a-z.]+$/.test(h);
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}

const PARIS = "Europe/Paris";

/** Date au format jour/mois/année, heure de Paris. */
export function formatParisDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { timeZone: PARIS, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Date et heure de Paris : 23/10/2026 à 20:28. */
export function formatParisDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = formatParisDate(value);
  const time = d.toLocaleTimeString("fr-FR", { timeZone: PARIS, hour: "2-digit", minute: "2-digit" });
  return `${day} à ${time}`;
}

/** Valeur pour un champ datetime-local, exprimée en heure de Paris. */
export function toParisInput(value: string | null | undefined): string {
  const d = value ? new Date(value) : new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}T${parts["hour"]}:${parts["minute"]}`;
}

/** Convertit une saisie datetime-local (heure de Paris) en instant ISO. */
export function fromParisInput(local: string): string {
  const guess = new Date(`${local}:00Z`);
  const shown = toParisInput(guess.toISOString());
  const diff = new Date(`${shown}:00Z`).getTime() - guess.getTime();
  return new Date(guess.getTime() - diff).toISOString();
}
