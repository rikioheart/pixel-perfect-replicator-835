import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
} from "lucide-react";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { useExternalLinks } from "@/lib/home-config";
import logoAsset from "@/assets/logo-lvdc.png.asset.json";

type Audience = "bureau" | "all" | "pro";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  audience: Audience;
  /** Entrées principales : 5 maximum par rôle, le reste est replié. */
  primary?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Cockpit Bureau",
    items: [
      { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, audience: "bureau", primary: true },
      { to: "/admin/cockpit", label: "Cockpit de pilotage", icon: Gauge, audience: "bureau", primary: true },
      { to: "/admin/validation", label: "Validations", icon: ShieldCheck, audience: "bureau", primary: true },
      { to: "/members", label: "Adhérents", icon: Users, audience: "bureau", primary: true },
      { to: "/inventory", label: "Ressources", icon: Package, audience: "bureau" },
      { to: "/admin/roles", label: "Rôles", icon: KeyRound, audience: "bureau" },
      { to: "/admin/permissions", label: "Permissions", icon: ShieldCheck, audience: "bureau" },
      { to: "/admin/loyalty-rules", label: "Règles de fidélité", icon: Stamp, audience: "bureau" },
      { to: "/admin/audit", label: "Journal d'activité", icon: ScrollText, audience: "bureau" },
      { to: "/admin/settings", label: "Paramétrage", icon: Settings2, audience: "bureau" },
    ],
  },
  {
    title: "Avancer ensemble",
    items: [
      { to: "/member", label: "Mon espace", icon: UserRound, audience: "all", primary: true },
      { to: "/projects", label: "Projets", icon: FolderKanban, audience: "all", primary: true },
      { to: "/tasks", label: "Tâches", icon: ListChecks, audience: "all", primary: true },
      { to: "/mindmap", label: "Mindmap", icon: Network, audience: "all" },
      { to: "/blog", label: "Journal interne", icon: Newspaper, audience: "all" },
      { to: "/documents", label: "Documents", icon: FileText, audience: "all" },
    ],
  },
  {
    title: "Vie de l'association",
    items: [
      { to: "/activities", label: "Activités", icon: CalendarDays, audience: "all", primary: true },
      { to: "/events", label: "Événements", icon: CalendarRange, audience: "all", primary: true },
      { to: "/professionals", label: "Professionnels", icon: Briefcase, audience: "all" },
      { to: "/partners", label: "Partenaires & avantages", icon: Handshake, audience: "all" },
      { to: "/terrain", label: "Terrain", icon: MapPin, audience: "pro" },
    ],
  },
  {
    title: "Moi",
    items: [
      { to: "/loyalty", label: "Ma fidélité", icon: Stamp, audience: "all" },
      { to: "/finance", label: "Mes finances", icon: Euro, audience: "all" },
      { to: "/notifications", label: "Notifications", icon: Bell, audience: "all" },
      { to: "/profile", label: "Mon profil & mes chiens", icon: UserRound, audience: "all" },
      { to: "/charter", label: "Notre façon de travailler", icon: HeartHandshake, audience: "all" },
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
  const { profile, isBureau, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isPro = (profile?.membership_type ?? "").toUpperCase().includes("PRO");
  const externalLinks = useExternalLinks();
  const visible = NAV_GROUPS.flatMap((group) => group.items).filter((item) => {
    if (item.audience === "bureau") return isBureau;
    if (item.audience === "pro") return isBureau || isPro;
    return true;
  });

  const primary = visible.filter((item) => item.primary).slice(0, 5);
  const primaryPaths = new Set(primary.map((item) => item.to));
  const secondary = visible.filter((item) => !primaryPaths.has(item.to));
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => secondary.includes(item)),
  })).filter((group) => group.items.length > 0);

  const renderLink = (item: NavItem) => {
    const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
    return (
      <Link
        key={item.to}
        to={item.to}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-200",
          active ? "surface-wine" : "opacity-80 hover:bg-sidebar-accent hover:opacity-100",
        )}
      >
        <item.icon className="size-4" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="surface-night sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto p-5 md:flex">
        <div>
          <div className="flex items-center gap-3 pb-8">
            <img
              src={logoAsset.url}
              alt="Logo La Voix du Chien"
              className="size-10 rounded-full bg-navy-foreground/10 object-contain p-0.5"
            />
            <div className="leading-tight">
              <p className="font-display text-sm">La Voix du Chien</p>
              <p className="text-xs opacity-70">{isBureau ? "Cockpit Bureau" : "Espace adhérent"}</p>
            </div>
          </div>
          <nav className="space-y-5">
            <div className="space-y-1">{primary.map(renderLink)}</div>

            {groups.length ? (
              <details className="group">
                <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wide opacity-50 hover:opacity-80">
                  Tout le reste
                </summary>
                <div className="mt-2 space-y-4">
                  {groups.map((group) => (
                    <div key={group.title} className="space-y-1">
                      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-40">
                        {group.title}
                      </p>
                      {group.items.map(renderLink)}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {externalLinks.length ? (
              <div className="space-y-1 border-t border-sidebar-border pt-4">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-40">
                  Outils partagés
                </p>
                {externalLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-80 transition-colors hover:bg-sidebar-accent hover:opacity-100"
                  >
                    <ExternalLink className="size-4" />
                    {link.label}
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
            <p className="text-xs opacity-70">{isBureau ? "Bureau" : profile?.membership_type}</p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
            className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100"
          >
            <LogOut className="size-3.5" /> Se déconnecter
          </button>
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
              <LogOut className="size-4" />
              Se déconnecter
            </Button>
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2 md:hidden">
          {groups.flatMap((group) => group.items).map((item) => (
            <Button key={item.to} asChild variant="ghost" size="sm">
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}

        </div>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
