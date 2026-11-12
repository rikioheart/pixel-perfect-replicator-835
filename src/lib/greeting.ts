/**
 * Salutation d'accueil : prénom (ou nom affiché), saison calculée localement à partir de la date,
 * et noms des chiens du foyer seulement s'ils ont été lus avec les droits de la personne connectée.
 * Aucune météo, aucun événement, aucun nom inventé.
 */
export type Season = "PRINTEMPS" | "ETE" | "AUTOMNE" | "HIVER";

/** Saisons astronomiques approximatives de l'hémisphère nord (France métropolitaine). */
export function seasonOf(date: Date): Season {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 320 && md < 621) return "PRINTEMPS";
  if (md >= 621 && md < 923) return "ETE";
  if (md >= 923 && md < 1221) return "AUTOMNE";
  return "HIVER";
}

/** « Uma », « Uma et Rex », « Uma, Rex et Kiko », au-delà « vos compagnons ». Null sans chien. */
export function dogPhrase(names: (string | null | undefined)[]): string | null {
  const clean = [...new Set(names.map((n) => (n ?? "").trim()).filter(Boolean))];
  if (clean.length === 0) return null;
  if (clean.length > 3) return "vos compagnons";
  if (clean.length === 1) return clean[0]!;
  return `${clean.slice(0, -1).join(", ")} et ${clean[clean.length - 1]}`;
}

const startsWithVowel = (s: string) => /^[aeiouyàâäéèêëîïôöùûüœæ]/i.test(s);
/** « de Rex », « d'Uma », « de vos compagnons ». */
export const deName = (phrase: string) => (startsWithVowel(phrase) ? `d'${phrase}` : `de ${phrase}`);

export function seasonLine(season: Season, dogs: string | null): string {
  const avec = dogs ? ` avec ${dogs}` : "";
  switch (season) {
    case "PRINTEMPS":
      return `Les journées s'allongent : une belle saison pour les balades${avec}.`;
    case "ETE":
      return `C'est l'été : pensez à l'eau fraîche et aux heures douces pour sortir${avec}.`;
    case "AUTOMNE":
      return `L'automne s'installe et les journées raccourcissent : profitez des sorties en journée${avec}.`;
    case "HIVER":
      return `C'est l'hiver : les journées sont courtes, prenez soin de vous${dogs ? ` et ${deName(dogs)}` : ""}.`;
  }
}

export type Greeting = { title: string; lines: string[] };

/**
 * full = première visite de la journée sur cet appareil : message chaleureux complet.
 * Ensuite, une salutation courte, pour ne pas répéter les mêmes phrases à chaque passage.
 */
export function buildGreeting({
  name,
  dogNames = [],
  date,
  full,
  roleMessage,
}: {
  name: string | null | undefined;
  dogNames?: (string | null | undefined)[] | undefined;
  date: Date;
  full: boolean;
  roleMessage?: string | undefined;
}): Greeting {
  const who = (name ?? "").trim();
  if (!full) return { title: who ? `Bonjour ${who}` : "Bonjour", lines: roleMessage ? [roleMessage] : [] };
  return {
    title: who ? `Bonjour ${who}, heureux de vous retrouver.` : "Bonjour, heureux de vous retrouver.",
    lines: ["Voici ce qui se passe dans votre espace aujourd'hui.", seasonLine(seasonOf(date), dogPhrase(dogNames))],
  };
}

/** Date locale AAAA-MM-JJ (fuseau de l'appareil), pour « première visite du jour ». */
export function localDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
