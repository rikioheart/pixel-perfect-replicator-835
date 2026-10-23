/**
 * Statut professionnel côté interface (affichage seulement, la base reste la frontière de sécurité).
 * Refus par défaut : sans réponse certaine du serveur, pas d'accès pro.
 * Seule exception : hors réseau réel, on réutilise la dernière vérification serveur de CE compte sur CET appareil.
 */
export type CachedRole = { owner: string; isPro: boolean; roles: string[]; verifiedAt: string };

export const ROLE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const roleCacheKey = (userId: string) => `lvdc.offline.role.${userId}`;

export function usableCachedRole(cached: CachedRole | null, userId: string, now = Date.now()): CachedRole | null {
  if (!cached || cached.owner !== userId) return null;
  const age = now - new Date(cached.verifiedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > ROLE_CACHE_MAX_AGE_MS) return null;
  return cached;
}

export function resolveProStatus(input: {
  rpcOk: boolean;
  rpcValue: unknown;
  offline: boolean;
  cached: CachedRole | null;
}): boolean {
  if (input.rpcOk) return input.rpcValue === true;
  if (input.offline && input.cached) return input.cached.isPro;
  return false;
}

export function readCachedRole(userId: string): CachedRole | null {
  try {
    return usableCachedRole(JSON.parse(localStorage.getItem(roleCacheKey(userId)) || "null"), userId);
  } catch {
    return null;
  }
}

export function saveCachedRole(role: CachedRole) {
  try {
    localStorage.setItem(roleCacheKey(role.owner), JSON.stringify(role));
  } catch {
    /* stockage indisponible : l'accès hors réseau restera fermé */
  }
}
