import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  ShieldCheck,
  UserRound,
  LogOut,
  
  Users,
  Network,
  KeyRound,
  ScrollText,
  Settings2,

  CalendarDays,
  CalendarRange,
  Stamp,
  Briefcase,
  Handshake,
  Euro,
  Package,
  MapPin,
  Newspaper,
  FileText,
  Bell,
  HeartHandshake,
  Gauge,
  BarChart3,
  CalendarCheck,
  UploadCloud,
  BookUser,
  LifeBuoy,
  Gift,
  History,
  Trophy,
  ReceiptText,
  GraduationCap,
  HandHeart as HandHeartIcon,
  Sparkles,
  Building2,
  Lightbulb,
  Menu,
  PawPrint,
  Dog,
  House,
  ClipboardList,
  Trees,
  Route as RouteIcon,
} from "lucide-react";
const HandHeart = HandHeartIcon;
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickCreateMenu } from "@/components/QuickCreateMenu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useExternalLinks } from "@/lib/home-config";
import { isNavItemPrimary, isNavItemVisible, memberHubTabFor, MEMBER_HUB_TABS } from "@/lib/nav-rules";
import { setNavSectionOpen, useNavSectionsOpen } from "@/lib/nav-state";
import logoAsset from "@/assets/logo-lvdc.png.asset.json";

type Audience = "bureau" | "all" | "pro";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  audience: Audience;
  /** Entrées principales : 5 maximum par rôle, le reste est replié. */
  primary?: boolean;
  primaryForParticulier?: boolean;
  /** Masqué pour les adhérents particuliers (ni bureau, ni professionnel). */
  hideForParticulier?: boolean;
  /** Libellé alternatif pour les membres du bureau. */
  bureauLabel?: string;
};

type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Mon activité professionnelle",
    items: [
      { to: "/espace-pro", label: "Tableau de bord pro", icon: LayoutDashboard, audience: "pro" },
      { to: "/espace-pro/carte", label: "Ma carte professionnelle", icon: Briefcase, audience: "pro" },
      { to: "/espace-pro/chiens", label: "Chiens accompagnés", icon: Dog, audience: "pro" },
      { to: "/espace-pro/collaborations", label: "Collaborations", icon: Handshake, audience: "pro" },
    ],
  },
  {
    title: "Gouvernance",
    items: [
      { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, audience: "bureau", primary: true },
      { to: "/admin/cockpit", label: "Cockpit de pilotage", icon: Gauge, audience: "bureau", primary: true },
      { to: "/admin/suivi-financier", label: "Suivi financier", icon: Euro, audience: "bureau" },
      { to: "/mindmap", label: "Mindmap", icon: Network, audience: "all", hideForParticulier: true },
      { to: "/notifications", label: "Notifications", icon: Bell, audience: "bureau", primary: true },
      { to: "/admin/validation", label: "Validations", icon: ShieldCheck, audience: "bureau", primary: true },
      { to: "/members", label: "Adhérents", icon: Users, audience: "bureau", primary: true },
      { to: "/inventory", label: "Ressources", icon: Package, audience: "bureau" },
      { to: "/admin/audit", label: "Journal d'activité", icon: ScrollText, audience: "bureau" },
      { to: "/statistics", label: "Statistiques", icon: BarChart3, audience: "bureau" },
      { to: "/admin/import", label: "Import d'adhérents", icon: UploadCloud, audience: "bureau" },
      { to: "/admin/advisor", label: "Conseiller d'équipe", icon: Sparkles, audience: "bureau" },
      { to: "/mairies", label: "Mairies & institutions", icon: Building2, audience: "bureau" },
      { to: "/admin/contributions", label: "Propositions d'aide", icon: HandHeart, audience: "bureau" },
      { to: "/admin/pros", label: "Fiches professionnelles", icon: Briefcase, audience: "bureau" },
      { to: "/admin/chiens", label: "Chiens de l'association", icon: Dog, audience: "bureau" },
    ],
  },
  {
    title: "Aujourd’hui et contribuer",
    items: [
      { to: "/member", label: "Mon Compagnon & Moi", icon: PawPrint, audience: "all", primary: true, primaryForParticulier: true },
      { to: "/projects", label: "Projets", icon: FolderKanban, audience: "all", primary: true },
      { to: "/tasks", label: "Tâches", icon: ListChecks, audience: "all", primary: true },
      { to: "/avancees", label: "Ce que nous construisons", icon: Sparkles, audience: "all" },
      { to: "/blog", label: "Journal interne", icon: Newspaper, audience: "all" },
      { to: "/documents", label: "Documents", icon: FileText, audience: "all", hideForParticulier: true },
    ],
  },
  {
    title: "Participer et communauté",
    items: [
      { to: "/activities", label: "Activités", icon: CalendarDays, audience: "all", primary: true, primaryForParticulier: true },
      { to: "/events", label: "Événements", icon: CalendarRange, audience: "all", primary: true, primaryForParticulier: true },
      { to: "/calendar", label: "Calendrier partagé", icon: CalendarDays, audience: "all" },
      { to: "/forms", label: "Formulaires", icon: ClipboardList, audience: "all" },
      { to: "/formations", label: "Formations & lives", icon: GraduationCap, audience: "all" },
      { to: "/contests", label: "Concours & animations", icon: Trophy, audience: "all" },
      { to: "/professionals", label: "Professionnels", icon: Briefcase, audience: "all" },
      { to: "/directory", label: "Annuaire du réseau", icon: BookUser, audience: "all", primaryForParticulier: true },
      { to: "/partners", label: "Partenaires & avantages", icon: Handshake, audience: "all" },
      { to: "/terrain", label: "Terrain", icon: Trees, audience: "pro" },
      { to: "/proposals", label: "Propositions", icon: Lightbulb, audience: "all" },
    ],
  },
  {
    title: "Mon espace et ressources",
    items: [
      {
        to: "/loyalty",
        label: "Ma fidélité",
        bureauLabel: "Engagement",
        icon: Stamp,
        audience: "all",
      },
      { to: "/finance", label: "Mes finances", icon: Euro, audience: "all", hideForParticulier: true },
      { to: "/participations", label: "Mes participations", icon: CalendarCheck, audience: "all" },
      { to: "/advantages", label: "Mes avantages", icon: Gift, audience: "all" },
      { to: "/reimbursements", label: "Paiements & remboursements", icon: ReceiptText, audience: "all" },
      { to: "/my-history", label: "Mon historique", icon: History, audience: "all" },
      { to: "/notifications", label: "Notifications", icon: Bell, audience: "all" },
      { to: "/my-space", label: "Mon espace personnel", icon: Settings2, audience: "all" },
      { to: "/parcours", label: "Mon parcours", icon: RouteIcon, audience: "all" },
      { to: "/foyer", label: "Mon foyer", icon: House, audience: "all" },
      { to: "/profile", label: "Mon profil & mes chiens", icon: Dog, audience: "all" },
      { to: "/help", label: "Centre d'aide", icon: LifeBuoy, audience: "all", primaryForParticulier: true },
      { to: "/help-requests", label: "Demandes d'aide", icon: HandHeart, audience: "all" },
      { to: "/charter", label: "Notre façon de travailler", icon: HeartHandshake, audience: "all" },
    ],
  },
  {
    title: "Intelligence et configuration",
    items: [
      { to: "/admin/loyalty-rules", label: "Règles de fidélité", icon: Stamp, audience: "bureau" },
      { to: "/admin/roles", label: "Rôles", icon: KeyRound, audience: "bureau" },
      { to: "/admin/permissions", label: "Permissions", icon: ShieldCheck, audience: "bureau" },
      { to: "/admin/settings", label: "Paramétrage", icon: Settings2, audience: "bureau" },
    ],
  },
];


export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { profile, isBureau, isPro, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const viewer = { isBureau, isPro };
  const externalLinks = useExternalLinks();
  const visible = NAV_GROUPS.flatMap((group) => group.items).filter((item) => isNavItemVisible(item, viewer));

  // Chaque page remonte AppShell : l'état des sections vit dans un store global persistant.
  const isOpen = useNavSectionsOpen();
  const [mobileOpen, setMobileOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const y = Number(window.sessionStorage.getItem("lvdc.nav.scroll") ?? 0);
    if (asideRef.current && y) asideRef.current.scrollTop = y;
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const primary = visible.filter((item) => isNavItemPrimary(item, viewer)).slice(0, 5);
  const hubTab = memberHubTabFor(pathname);
  const primaryPaths = new Set(primary.map((item) => item.to));
  const seen = new Set(primaryPaths);
  const secondary = visible.filter((item) => {
    if (seen.has(item.to)) return false;
    seen.add(item.to);
    return true;
  });
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => secondary.includes(item)),
  })).filter((group) => group.items.length > 0);

  const renderLink = (item: NavItem, mobile = false) => {
    const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
    const link = (
      <Link
        key={`${item.to}-${item.label}`}
        to={item.to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          active ? "surface-wine" : "hover:bg-sidebar-accent",
        )}
      >
        <item.icon className="size-4" aria-hidden="true" />
        {isBureau && item.bureauLabel ? item.bureauLabel : item.label}
      </Link>
    );
    return mobile ? <SheetClose key={`${item.to}-${item.label}`} asChild>{link}</SheetClose> : link;
  };


  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#contenu-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Aller au contenu principal
      </a>
      <aside
        ref={asideRef}
        onScroll={(e) => window.sessionStorage.setItem("lvdc.nav.scroll", String(e.currentTarget.scrollTop))}
        aria-label="Menu latéral"
        className="surface-night sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between overflow-y-auto p-5 md:flex"
      >
        <div>
          <div className="flex items-center gap-3 pb-8">
            <img
              src={logoAsset.url}
              alt="Logo La Voix du Chien"
              className="h-10 w-auto max-w-44 object-contain"
            />
            <div className="leading-tight">
              <p className="font-display text-sm">La Voix du Chien</p>
              <p className="text-xs">{isBureau ? "Cockpit Bureau" : isPro ? "Espace professionnel" : "Espace adhérent"}</p>
            </div>
          </div>
          <nav aria-label="Navigation des pages" className="space-y-5">
            <div className="space-y-1">{primary.map((item) => renderLink(item))}</div>

            {groups.length ? (
              <details
                className="group"
                open={isOpen("__more")}
                onToggle={(e) => setNavSectionOpen("__more", e.currentTarget.open)}
              >
                <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Tout le reste
                </summary>
                <div className="mt-2 space-y-2">
                  {groups.map((group) => {
                    const hasActive = group.items.some(
                      (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
                    );
                    return (
                      <details
                        key={group.title}
                        open={hasActive || isOpen(group.title)}
                        onToggle={(e) => {
                          if (!hasActive) setNavSectionOpen(group.title, e.currentTarget.open);
                        }}
                        className="space-y-1"
                      >
                        <summary className="cursor-pointer list-none rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {group.title}
                        </summary>
                        {group.items.map((item) => renderLink(item))}
                      </details>
                    );
                  })}
                </div>
              </details>
            ) : null}

            {externalLinks.length ? (
              <div className="space-y-1 border-t border-sidebar-border pt-4">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide">
                  Outils partagés
                </p>
                {externalLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    <span>
                      {link.label}
                      <span className="sr-only"> (s'ouvre dans un nouvel onglet)</span>
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
          </nav>
        </div>
        <div className="space-y-3 border-t border-sidebar-border pt-4 text-sm">
          <div>
            <p className="truncate font-medium">
              {profile?.display_name ?? profile?.first_name ?? "Membre"}
            </p>
            <p className="text-xs">{isBureau ? "Bureau" : profile?.membership_type}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
            className="min-h-11 justify-start gap-2 px-0 text-xs hover:underline"
          >
            <LogOut className="size-3.5" aria-hidden="true" /> Se déconnecter
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-card px-6 py-5">
          <div>
            <h1 className="text-2xl">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <QuickCreateMenu />
            <div className="hidden items-center gap-2 md:flex">
            <GlobalSearch />
            <NotificationBell />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/" });
              }}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Se déconnecter
            </Button>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" aria-label="Ouvrir le menu principal">
                <Menu className="size-4" aria-hidden="true" /> Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[88vw] overflow-y-auto p-0 sm:max-w-sm">
              <SheetHeader className="border-b border-border p-5 text-left">
                <SheetTitle>La Voix du Chien</SheetTitle>
                <SheetDescription>{isBureau ? "Gouvernance et actions" : "Votre espace associatif"}</SheetDescription>
              </SheetHeader>
              <nav aria-label="Navigation mobile" className="space-y-6 p-4">
                {NAV_GROUPS.map((group) => {
                  const groupItems = group.items.filter((item) => visible.includes(item));
                  if (!groupItems.length) return null;
                  return (
                    <div key={group.title} className="space-y-1">
                      <p className="px-3 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                        {group.title}
                      </p>
                      {groupItems.map((item) => renderLink(item, true))}
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="min-h-11 w-full justify-start gap-2"
                  onClick={async () => {
                    await signOut();
                    void navigate({ to: "/" });
                  }}
                >
                  <LogOut className="size-4" aria-hidden="true" /> Se déconnecter
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
          <p className="truncate text-sm font-medium">
            {visible.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.label ?? title}
          </p>
          <div className="flex items-center gap-1">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </div>

        <main id="contenu-principal" tabIndex={-1} className="flex-1 p-6 focus:outline-none">
          {hubTab && !isBureau ? (
            <nav aria-label="Mon Compagnon & Moi" className="-mt-2 mb-5 flex gap-1 overflow-x-auto border-b border-border pb-2">
              {MEMBER_HUB_TABS.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  aria-current={hubTab === t.to ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    hubTab === t.to ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
