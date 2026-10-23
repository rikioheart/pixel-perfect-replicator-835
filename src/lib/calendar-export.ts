/**
 * Export vers un agenda personnel, sans API : fichier .ics et lien Google Agenda prérempli.
 * Les dates sont émises en UTC (suffixe Z) : chaque agenda les affiche dans le fuseau de l'appareil,
 * ce qui évite tout décalage aux changements d'heure. Aucune note interne ni participant n'est inclus.
 */
export type AgendaItem = {
  uid: string;
  title: string;
  start: string | Date;
  end?: string | Date | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
};

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

function toUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function range(item: AgendaItem): [Date, Date] {
  const start = new Date(item.start);
  const endRaw = item.end ? new Date(item.end) : null;
  const end = endRaw && endRaw.getTime() > start.getTime() ? endRaw : new Date(start.getTime() + DEFAULT_DURATION_MS);
  return [start, end];
}

/** Échappement RFC 5545 des textes. */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Repli des lignes à 75 octets (RFC 5545). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (curLen + len > (out.length ? 74 : 75)) { out.push(cur); cur = ""; curLen = 0; }
    cur += ch; curLen += len;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(item: AgendaItem, now: Date = new Date()): string {
  const [start, end] = range(item);
  const desc = [item.description?.trim(), item.url].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Voix du Chien//Plateforme//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${item.uid}@lavoixduchien`,
    `DTSTAMP:${toUtcStamp(now)}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(item.title)}`,
    item.location ? `LOCATION:${escapeIcsText(item.location)}` : "",
    desc ? `DESCRIPTION:${escapeIcsText(desc)}` : "",
    item.url ? `URL:${item.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(item: AgendaItem): string {
  const [start, end] = range(item);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    ctz: "Europe/Paris",
  });
  const details = [item.description?.trim(), item.url].filter(Boolean).join("\n\n");
  if (details) p.set("details", details.slice(0, 1500));
  if (item.location) p.set("location", item.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function downloadIcs(item: AgendaItem) {
  const blob = new Blob([buildIcs(item)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${item.title.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "evenement"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
