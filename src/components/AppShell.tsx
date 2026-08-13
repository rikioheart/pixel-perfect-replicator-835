import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  ShieldCheck,
  UserRound,
  LogOut,
  PawPrint,
  Users,
  Network,
  KeyRound,
  ScrollText,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";

const navItems = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, bureauOnly: true },
  { to: "/member", label: "Mon espace", icon: UserRound, bureauOnly: false },
  { to: "/members", label: "Adhérents", icon: Users, bureauOnly: true },
  { to: "/projects", label: "Projets", icon: FolderKanban, bureauOnly: false },
  { to: "/tasks", label: "Tâches", icon: ListChecks, bureauOnly: false },
  { to: "/mindmap", label: "Mindmap", icon: Network, bureauOnly: false },
  { to: "/admin/validation", label: "Validations", icon: ShieldCheck, bureauOnly: true },
  { to: "/admin/roles", label: "Rôles", icon: KeyRound, bureauOnly: true },
  { to: "/admin/audit", label: "Journal", icon: ScrollText, bureauOnly: true },
] as const;

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

  const items = navItems.filter((item) => !item.bureauOnly || isBureau);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="surface-night hidden w-64 shrink-0 flex-col justify-between p-5 md:flex">
        <div>
          <div className="flex items-center gap-2 pb-8">
            <PawPrint className="size-6" />
            <div className="leading-tight">
              <p className="font-display text-sm">La Voix du Chien</p>
              <p className="text-xs opacity-70">Cockpit associatif</p>
            </div>
          </div>
          <nav className="space-y-1">
            {items.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "surface-wine" : "opacity-80 hover:bg-sidebar-accent hover:opacity-100",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
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
          {items.map((item) => (
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
