/** Repères statutaires de l'assemblée générale ordinaire (article 16). */
export const AG_MONTH = 5; // juin (0 = janvier)
export const AG_QUORUM = 8;
export const AG_CONVOCATION_DAYS = 15;

/** Date limite d'envoi des convocations pour une AG à la date donnée (AAAA-MM-JJ). */
export function convocationDeadline(agDate: string): string {
  const date = new Date(`${agDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - AG_CONVOCATION_DAYS);
  return date.toISOString().slice(0, 10);
}

export function isInAgMonth(agDate: string): boolean {
  return Number(agDate.slice(5, 7)) - 1 === AG_MONTH;
}

export function quorumReached(present: number): boolean {
  return present >= AG_QUORUM;
}

/** Prochaine AG ordinaire : juin de l'année en cours, ou de l'année suivante si juin est passé. */
export function nextAgYear(today: Date): number {
  return today.getUTCMonth() > AG_MONTH ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
}
