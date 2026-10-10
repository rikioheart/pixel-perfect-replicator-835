/** Reconnaissance indicative d'un service à partir de l'URL. En cas d'échec : lien générique. */
export type ServiceKey = "DRIVE" | "DOCS" | "FORMS" | "SHEETS" | "CALENDAR" | "MEET" | "RINTINTIN" | "LINK";

export const SERVICE_LABEL: Record<ServiceKey, string> = {
  DRIVE: "Google Drive", DOCS: "Google Docs", FORMS: "Google Forms", SHEETS: "Google Sheets",
  CALENDAR: "Google Agenda", MEET: "Google Meet", RINTINTIN: "Rintintin", LINK: "Lien externe",
};

export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null; // refuse javascript:, data:, etc.
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function detectService(url: string): ServiceKey {
  let u: URL;
  try { u = new URL(url); } catch { return "LINK"; }
  const h = u.hostname.toLowerCase();
  const p = u.pathname;
  if (h === "meet.google.com") return "MEET";
  if (h === "forms.gle" || (h === "docs.google.com" && p.startsWith("/forms"))) return "FORMS";
  if (h === "docs.google.com" && p.startsWith("/spreadsheets")) return "SHEETS";
  if (h === "docs.google.com") return "DOCS";
  if (h === "drive.google.com") return "DRIVE";
  if (h === "calendar.google.com" || h === "calendar.app.google") return "CALENDAR";
  if (h === "rintintin.app" || h.endsWith(".rintintin.app") || h.includes("rintintin")) return "RINTINTIN";
  return "LINK";
}

export function defaultTitle(url: string): string {
  const s = detectService(url);
  if (s !== "LINK") return SERVICE_LABEL[s];
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Lien"; }
}
