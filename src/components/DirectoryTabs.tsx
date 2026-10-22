import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

const TABS = [
  { to: "/directory", label: "Réseau", bureau: false },
  { to: "/professionals", label: "Professionnels", bureau: false },
  { to: "/partners", label: "Partenaires & avantages", bureau: false },
  { to: "/members", label: "Adhérents (Bureau)", bureau: true },
  { to: "/mairies", label: "Mairies & institutions", bureau: true },
] as const;

/** Guichet unique : chaque annuaire existant devient un onglet d'un même espace. Les onglets Bureau restent protégés par leur page et la RLS. */
export function DirectoryTabs() {
  const { isBureau } = useAuth();
  return (
    <nav aria-label="Annuaire & Réseau" className="mb-5 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {TABS.filter((t) => !t.bureau || isBureau).map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
