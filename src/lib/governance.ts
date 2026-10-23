/**
 * Besoins de décision du Bureau : vue agrégée, sans table dédiée.
 * Chaque élément renvoie vers sa source de référence (proposition, contribution, réservation, demande d'aide) ;
 * aucun statut n'est recopié ni modifié ici.
 */
export type GovBucket = "decide" | "arbitrage" | "followup";
export type GovPriority = "URGENTE" | "NORMALE";

export type GovItem = {
  key: string;
  source: string;
  title: string;
  context?: string | null;
  state: string;
  bucket: GovBucket;
  since: string;
  due?: string | null;
  owner?: string | null;
  action: string;
  link: string;
};

/** Délais (jours) au-delà desquels un sujet devient prioritaire. */
export const WAITING_ALERT_DAYS = 14;
export const DUE_ALERT_DAYS = 7;

const DAY = 86_400_000;
const dayStart = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");

/** Priorité déterministe : échéance proche ou dépassée, ou sujet en attente depuis trop longtemps. */
export function priorityOf(item: Pick<GovItem, "bucket" | "since" | "due">, today: string): GovPriority {
  const now = dayStart(today);
  if (item.due) {
    const left = (dayStart(item.due) - now) / DAY;
    if (item.bucket === "followup" ? left < 0 : left <= DUE_ALERT_DAYS) return "URGENTE";
  }
  if (item.bucket !== "followup" && (now - dayStart(item.since)) / DAY >= WAITING_ALERT_DAYS) return "URGENTE";
  return "NORMALE";
}

/** Classement d'une contribution (propositions d'aide) selon son statut. */
export function contributionBucket(status: string): GovBucket | null {
  if (status === "PROPOSED") return "decide";
  if (status === "DISCUSSION" || status === "BLOCKED") return "arbitrage";
  if (status === "ACCEPTED" || status === "IN_PROGRESS") return "followup";
  return null;
}

/** Classement d'une réservation de terrain ; une réservation acceptée passée n'est plus suivie. */
export function terrainBucket(status: string, date: string, today: string): GovBucket | null {
  if (status === "PENDING") return "decide";
  if (status === "CHANGES_REQUESTED") return "arbitrage";
  if (status === "APPROVED" && date >= today) return "followup";
  return null;
}

/** Tri : urgentes d'abord, puis échéance la plus proche, puis ancienneté. */
export function sortGov(items: GovItem[], today: string): GovItem[] {
  const rank = (i: GovItem) => (priorityOf(i, today) === "URGENTE" ? 0 : 1);
  return [...items].sort((a, b) =>
    rank(a) - rank(b)
    || (a.due ?? "9999").localeCompare(b.due ?? "9999")
    || a.since.localeCompare(b.since));
}

/** Marqueur stable inscrit dans la tâche créée depuis une décision du registre (anti-doublon, retour au contexte). */
export function decisionTaskMarker(recordId: string): string {
  return `[registre:${recordId}]`;
}
