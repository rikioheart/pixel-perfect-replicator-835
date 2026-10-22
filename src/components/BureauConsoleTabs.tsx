import { Link } from "@tanstack/react-router";

const TABS = [
  { to: "/admin", label: "Console" },
  { to: "/admin/validation", label: "Validations" },
  { to: "/finance", label: "Comptabilité & remboursements" },
  { to: "/admin/suivi-financier", label: "Suivi des opérations" },
] as const;

/** Une seule console Bureau : /admin est l'entrée canonique, les écrans spécialisés sont des onglets. */
export function BureauConsoleTabs() {
  return (
    <nav aria-label="Console du Bureau" className="mb-5 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: true }}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
