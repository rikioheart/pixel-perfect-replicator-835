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
  QrCode,
  Globe,
  Building2,
  Lightbulb,
  Menu,
  Heart,

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
import { isNavItemVisible } from "@/lib/nav-rules";
import { FloatingHelpButton } from "@/components/FloatingHelpButton";
import { useApplyPreferences } from "@/lib/user-preferences";
import { OfflineStatus } from "@/components/OfflineStatus";
import logoAsset from "@/assets/logo-lvdc.png.asset.json";
import logoMark from "@/assets/logo-lvdc-mark.png.asset.json";

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

type NavGroup = { title: string; icon: typeof LayoutDashboard; items: NavItem[] };

const CONSOLE_PATHS = new Set(["/admin", "/admin/gouvernance", "/admin/validation", "/finance", "/admin/suivi-financier"]);

/** Familles lisibles (Réseau, Ressources, Paramètres = regroupements de routes existantes) ; les permissions restent appliquées par la base. */
const NAV_GROUPS: NavGroup[] = [
  {
    title: "Mon foyer & moi",
    icon: Heart,
    items: [
      { to: "/member", label: "Accueil", icon: Heart, audience: "all" },
      { to: "/foyer", label: "Mes chiens & foyer", icon: House, audience: "all" },
      { to: "/participations", label: "Mes inscriptions", icon: CalendarCheck, audience: "all" },
      { to: "/reimbursements", label: "Paiements", icon: ReceiptText, audience: "all" },
      { to: "/advantages", label: "Avantages", icon: Gift, audience: "all" },
      { to: "/profile", label: "Profil & données", icon: UserRound, audience: "all" },
      { to: "/my-space", label: "Préférences", icon: Settings2, audience: "all" },
      { to: "/my-history", label: "Historique", icon: History, audience: "all" },
      { to: "/parcours", label: "Parcours", icon: RouteIcon, audience: "all" },
    ],
  },
  {
    title: "Sorties & agenda",
    icon: CalendarDays,
    items: [
      { to: "/activities", label: "Activités", icon: CalendarDays, audience: "all" },
      { to: "/events", label: "Événements", icon: CalendarRange, audience: "all" },
      { to: "/calendar", label: "Calendrier", icon: CalendarDays, audience: "all" },
      { to: "/formations", label: "Formations", icon: GraduationCap, audience: "all" },
      { to: "/contests", label: "Animations", icon: Trophy, audience: "all" },
    ],
  },
  {
    title: "Projets & entraide",
    icon: FolderKanban,
    items: [
      { to: "/projects", label: "Projets", icon: FolderKanban, audience: "all" },
      { to: "/tasks", label: "Tâches", icon: ListChecks, audience: "all" },
      { to: "/proposals", label: "Idées", icon: Lightbulb, audience: "all" },
      { to: "/help-requests", label: "Entraide", icon: HandHeart, audience: "all" },
      { to: "/avancees", label: "Nos avancées", icon: Sparkles, audience: "all" },
      { to: "/blog", label: "Journal", icon: Newspaper, audience: "all" },
      { to: "/mindmap", label: "Carte des projets", icon: Network, audience: "all", hideForParticulier: true },
    ],
  },
  {
    title: "Réseau & annuaire",
    icon: BookUser,
    items: [
      { to: "/directory", label: "Annuaire", icon: BookUser, audience: "all" },
    ],
  },
  {
    title: "Ressources",
    icon: LifeBuoy,
    items: [
      { to: "/forms", label: "Formulaires", icon: ClipboardList, audience: "all" },
      { to: "/documents", label: "Documents", icon: FileText, audience: "all", hideForParticulier: true },
      { to: "/help", label: "Guides", icon: LifeBuoy, audience: "all" },
      { to: "/charter", label: "Notre façon de travailler", icon: HeartHandshake, audience: "all" },
    ],
  },
  {
    title: "Espace pro",
    icon: Briefcase,
    items: [
      { to: "/espace-pro", label: "Tableau de bord", icon: LayoutDashboard, audience: "pro" },
      { to: "/espace-pro/carte", label: "Ma carte", icon: Briefcase, audience: "pro" },
      { to: "/espace-pro/chiens", label: "Chiens accompagnés", icon: Heart, audience: "pro" },
      { to: "/espace-pro/collaborations", label: "Collaborations", icon: Handshake, audience: "pro" },
    ],
  },
  {
    title: "Console du Bureau",
    icon: ShieldCheck,
    items: [
      { to: "/admin", label: "Console", icon: LayoutDashboard, audience: "bureau" },
      { to: "/admin/validation", label: "Validations", icon: ShieldCheck, audience: "bureau" },
      { to: "/admin/suivi-financier", label: "Suivi financier", icon: Euro, audience: "bureau" },
      { to: "/finance", label: "Comptabilité", icon: Euro, audience: "bureau" },
      { to: "/admin/contributions", label: "Propositions d'aide", icon: HandHeart, audience: "bureau" },
      { to: "/admin/pros", label: "Fiches pros", icon: Briefcase, audience: "bureau" },
      { to: "/admin/chiens", label: "Foyers & chiens", icon: Heart, audience: "bureau" },
      { to: "/inventory", label: "Matériel", icon: Package, audience: "bureau" },
      { to: "/terrain", label: "Terrain (gestion)", icon: Trees, audience: "bureau" },
    ],
  },
  {
    title: "Paramètres",
    icon: Settings2,
    items: [
      { to: "/admin/roles", label: "Rôles", icon: KeyRound, audience: "bureau" },
      { to: "/admin/permissions", label: "Permissions", icon: ShieldCheck, audience: "bureau" },
      { to: "/admin/settings", label: "Paramétrage", icon: Settings2, audience: "bureau" },
      { to: "/admin/loyalty-rules", label: "Fidélité", icon: Stamp, audience: "bureau" },
      { to: "/admin/import", label: "Import", icon: UploadCloud, audience: "bureau" },
      { to: "/statistics", label: "Statistiques", icon: BarChart3, audience: "bureau" },
      { to: "/admin/audit", label: "Journal", icon: ScrollText, audience: "bureau" },
      { to: "/admin/advisor", label: "Conseiller", icon: Sparkles, audience: "bureau" },
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
  useApplyPreferences();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const viewer = { isBureau, isPro };
  const externalLinks = useExternalLinks();
  const visible = NAV_GROUPS.flatMap((group) => group.items).filter((item) => isNavItemVisible(item, viewer));
  const pillars = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isNavItemVisible(item, viewer)),
  })).filter((group) => group.items.length > 0);
  // Page active = entrée la plus précise correspondant à l'adresse.
  const activeItem = visible
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  const activePillar = activeItem ? pillars.find((g) => g.items.includes(activeItem)) : undefined;
  // Les pages de la console Bureau ont déjà leurs propres onglets : pas de seconde rangée.
  const pillarTabs = activePillar && !CONSOLE_PATHS.has(pathname) ? activePillar.items.filter((i) => !(activePillar.title === "Console du Bureau" && CONSOLE_PATHS.has(i.to))) : [];

  const [mobileOpen, setMobileOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const y = Number(window.sessionStorage.getItem("lvdc.nav.scroll") ?? 0);
    if (asideRef.current && y) asideRef.current.scrollTop = y;
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const dock = isBureau
    ? [{ to: "/admin", label: "Bureau", icon: LayoutDashboard }, { to: "/tasks", label: "Actions", icon: ListChecks }, { to: "/loyalty", label: "Mon pass", icon: QrCode }, { to: "/member", label: "Mon espace", icon: UserRound }]
    : isPro
      ? [{ to: "/espace-pro", label: "Espace pro", icon: Briefcase }, { to: "/espace-pro/chiens", label: "Chiens", icon: Heart }, { to: "/activities", label: "Sorties", icon: CalendarDays }, { to: "/loyalty", label: "Mon pass", icon: Stamp }]
      : [{ to: "/member", label: "Mon chien", icon: Heart }, { to: "/activities", label: "Sorties", icon: CalendarDays }, { to: "/loyalty", label: "Mon pass", icon: Stamp }, { to: "/projects", label: "Projets", icon: FolderKanban }];

  const renderPillar = (group: (typeof pillars)[number], mobile = false) => {
    const active = activePillar?.title === group.title;
    const hub = group.items[0]!;
    const link = (
      <Link
        key={group.title}
        to={hub.to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-200 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          active ? "surface-wine" : mobile ? "hover:bg-accent" : "hover:bg-sidebar-accent",
        )}
      >
        <group.icon className="size-4" aria-hidden="true" />
        {group.title}
      </Link>
    );
    return mobile ? <SheetClose key={group.title} asChild>{link}</SheetClose> : link;
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
          <Link to="/loyalty" className="mb-5 flex min-h-11 items-center gap-3 rounded-md border border-sidebar-border px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
            <QrCode className="size-4" aria-hidden="true" /> Mon pass
          </Link>
          <nav aria-label="Navigation des pages" className="space-y-5">
            <div className="space-y-1">{pillars.map((g) => renderPillar(g))}</div>

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
            <Link to="/" search={{ vitrine: 1 }} className="mt-1 flex min-h-11 items-center gap-2 text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Globe className="size-3.5" aria-hidden="true" /> Voir la vitrine
            </Link>
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
          <div className="flex max-w-full flex-wrap items-center gap-2">
            {actions}
            <QuickCreateMenu />
            <div className="hidden items-center gap-2 md:flex">
            <GlobalSearch />
            <NotificationBell />
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
                <Link to="/loyalty" className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"><QrCode className="size-4" aria-hidden="true" /> Mon pass</Link>
                <div className="space-y-1">{pillars.map((g) => renderPillar(g, true))}</div>
                <Link to="/" search={{ vitrine: 1 }} className="flex min-h-11 items-center gap-3 px-3 text-sm hover:underline"><Globe className="size-4" aria-hidden="true" /> Voir la vitrine</Link>
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
          
          <div className="flex items-center gap-1">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </div>

        <main id="contenu-principal" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 pb-28 focus:outline-none md:p-6">
          <OfflineStatus />
          {pillarTabs.length > 1 ? (
            <nav aria-label={activePillar!.title} className="mb-5 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
              {pillarTabs.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  aria-current={activeItem?.to === t.to ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-lg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeItem?.to === t.to ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {isBureau && t.bureauLabel ? t.bureauLabel : t.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {profile?.membership_status === "PENDING" ? (
            <p role="status" className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">
              Bienvenue ! Votre adhésion est en attente de validation par le Bureau. Vous pouvez déjà découvrir votre espace ; vous serez prévenu dès qu'elle sera validée.
            </p>
          ) : profile?.membership_status === "REFUSED" ? (
            <p role="status" className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">
              Votre demande d'adhésion n'a pas été retenue pour le moment. Pour en parler, écrivez au Bureau depuis le site officiel lavoixduchien.fr.
            </p>
          ) : null}
          {children}
        </main>
      </div>
      <FloatingHelpButton />
      <nav aria-label="Accès rapides mobile" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card px-1 pt-1 shadow-lg md:hidden" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
        {dock.map(t => <Link key={t.to} to={t.to} aria-current={pathname === t.to ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px]", pathname === t.to ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")}><t.icon className="size-5" aria-hidden />{t.label}</Link>)}
        <Button variant="ghost" onClick={() => setMobileOpen(true)} className="h-auto min-h-14 flex-col gap-1 px-1 text-[11px]" aria-label="Ouvrir tous les espaces"><Menu className="size-5" aria-hidden />Plus</Button>
      </nav>
    </div>
  );
}
