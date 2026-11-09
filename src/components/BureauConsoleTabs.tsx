import { Link } from "@tanstack/react-router";

const TABS = [
  { to: "/admin", label: "Console" },
  { to: "/admin/gouvernance", label: "Besoins de décision" },
  { to: "/admin/validation", label: "Validations" },
  { to: "/finance", label: "Comptabilité & remboursements" },
  { to: "/admin/suivi-financier", label: "Suivi des opérations" },
  { to: "/admin/communication", label: "Communication" },
] as const;

/** Une seule console Bureau : /admin est l'entrée canonique, les écrans spécialisés sont des onglets. */
export function BureauConsoleTabs() {
  return (
    <nav aria-label="Console du Bureau" className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 md:flex-wrap">
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: true }}
          className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
