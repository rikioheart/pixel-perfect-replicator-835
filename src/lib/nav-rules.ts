export type NavAudience = "bureau" | "all" | "pro";

export type NavRuleItem = {
  audience: NavAudience;
  hideForParticulier?: boolean;
  primary?: boolean;
  /** Entrée principale pour un particulier (remplace `primary` pour ce rôle). */
  primaryForParticulier?: boolean;
};

export type NavViewer = { isBureau: boolean; isPro: boolean };

/** Affichage seulement : la sécurité reste assurée par la base (RLS). */
export function isNavItemVisible(item: NavRuleItem, viewer: NavViewer): boolean {
  const particulier = !viewer.isBureau && !viewer.isPro;
  if (item.hideForParticulier && particulier) return false;
  if (item.audience === "bureau") return viewer.isBureau;
  if (item.audience === "pro") return viewer.isBureau || viewer.isPro;
  return true;
}

export function isNavItemPrimary(item: NavRuleItem, viewer: NavViewer): boolean {
  const particulier = !viewer.isBureau && !viewer.isPro;
  return particulier ? Boolean(item.primaryForParticulier) : Boolean(item.primary);
}

/** Pages regroupées dans l'espace personnel unifié « Mon Compagnon & Moi ». */
export const MEMBER_HUB_TABS = [
  { to: "/member", label: "Accueil" },
  { to: "/foyer", label: "Mon foyer & mes chiens" },
  { to: "/participations", label: "Mes sorties" },
  { to: "/terrain", label: "Mes réservations" },
  { to: "/loyalty", label: "Mon pass & tampons" },
  { to: "/advantages", label: "Avantages" },
  { to: "/parcours", label: "Mon parcours" },
  { to: "/my-history", label: "Historique" },
  { to: "/profile", label: "Profil" },
  { to: "/my-space", label: "Préférences" },
] as const;

export function memberHubTabFor(pathname: string): string | null {
  const hit = MEMBER_HUB_TABS.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));
  return hit ? hit.to : null;
}

/** Four stable families; every existing personal page remains reachable. */
export const MEMBER_HUB_GROUPS = [
  { label: "Mon chien", to: "/member", paths: ["/member", "/foyer"] },
  { label: "Sorties", to: "/participations", paths: ["/participations", "/terrain"] },
  { label: "Mon pass", to: "/loyalty", paths: ["/loyalty", "/advantages"] },
  { label: "Profil & foyer", to: "/profile", paths: ["/profile", "/my-space", "/parcours", "/my-history"] },
] as const;

export function memberHubGroupFor(pathname: string) {
  return MEMBER_HUB_GROUPS.find((g) => g.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
}

/**
 * Espace pro : refus par défaut. Ouvert seulement quand les rôles sont connus et que le compte est
 * pro validé ou Bureau (hors réseau : dernière vérification serveur de ce compte, voir pro-status.ts).
 */
export function canOpenProSpace(v: NavViewer & { rolesReady: boolean }): boolean {
  return v.rolesReady && (v.isPro || v.isBureau);
}

/** Création de formulaires : Bureau ou professionnel actif seulement, jamais un particulier (doublé par la base). */
export function canCreateForm(v: NavViewer): boolean {
  return v.isBureau || v.isPro;
}
