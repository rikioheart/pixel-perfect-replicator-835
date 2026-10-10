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
  { to: "/loyalty", label: "Mon pass & tampons" },
  { to: "/advantages", label: "Avantages" },
  { to: "/parcours", label: "Mon parcours" },
  { to: "/profile", label: "Profil" },
  { to: "/my-space", label: "Préférences" },
] as const;

export function memberHubTabFor(pathname: string): string | null {
  const hit = MEMBER_HUB_TABS.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));
  return hit ? hit.to : null;
}

/** Repli si la vérification serveur du statut pro est indisponible. */
export function fallbackIsPro(membershipType: string | null | undefined): boolean {
  return (membershipType ?? "").toUpperCase().includes("PRO");
}
