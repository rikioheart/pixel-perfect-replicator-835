import { describe, expect, it } from "vitest";
import { resolveProStatus, usableCachedRole, ROLE_CACHE_MAX_AGE_MS, type CachedRole } from "./pro-status";

const now = Date.parse("2026-10-23T10:00:00Z");
const cache = (over: Partial<CachedRole> = {}): CachedRole => ({ owner: "pro", isPro: true, roles: [], verifiedAt: new Date(now - 1000).toISOString(), ...over });

describe("statut pro : refus par défaut", () => {
  it("suit la réponse serveur quand elle existe", () => {
    expect(resolveProStatus({ rpcOk: true, rpcValue: true, offline: false, cached: null })).toBe(true);
    expect(resolveProStatus({ rpcOk: true, rpcValue: false, offline: true, cached: cache() })).toBe(false);
  });
  it("refuse si le serveur échoue en ligne, même avec un cache pro", () => {
    expect(resolveProStatus({ rpcOk: false, rpcValue: null, offline: false, cached: cache() })).toBe(false);
  });
  it("refuse si le serveur échoue sans cache", () => {
    expect(resolveProStatus({ rpcOk: false, rpcValue: null, offline: true, cached: null })).toBe(false);
  });
  it("hors réseau, réutilise la dernière vérification de ce compte", () => {
    expect(resolveProStatus({ rpcOk: false, rpcValue: null, offline: true, cached: cache() })).toBe(true);
    expect(resolveProStatus({ rpcOk: false, rpcValue: null, offline: true, cached: cache({ isPro: false }) })).toBe(false);
  });
  it("une réponse non booléenne ne vaut jamais accès", () => {
    expect(resolveProStatus({ rpcOk: true, rpcValue: "true", offline: false, cached: null })).toBe(false);
  });
});

describe("cache de rôle local", () => {
  it("ignore le cache d'un autre compte", () => expect(usableCachedRole(cache(), "autre", now)).toBeNull());
  it("expire après 7 jours", () => {
    expect(usableCachedRole(cache({ verifiedAt: new Date(now - ROLE_CACHE_MAX_AGE_MS - 1).toISOString() }), "pro", now)).toBeNull();
    expect(usableCachedRole(cache({ verifiedAt: new Date(now - ROLE_CACHE_MAX_AGE_MS + 60_000).toISOString() }), "pro", now)).not.toBeNull();
  });
  it("refuse une date future ou invalide", () => {
    expect(usableCachedRole(cache({ verifiedAt: new Date(now + 60_000).toISOString() }), "pro", now)).toBeNull();
    expect(usableCachedRole(cache({ verifiedAt: "n'importe quoi" }), "pro", now)).toBeNull();
  });
});
