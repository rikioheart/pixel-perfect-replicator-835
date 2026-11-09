import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export type DirectoryView =
  "pros" | "particuliers" | "partenaires" | "chiens" | "mairies" | "adherents";

/**
 * Bandeau unique de l'annuaire : chaque vue garde ses propres filtres sur sa page.
 * Les vues Bureau restent protégées par leur page et la RLS.
 */
export function DirectoryTabs({ current }: { current: DirectoryView }) {
  const { isBureau } = useAuth();
  const base = "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm";
  const cls = (view: DirectoryView) =>
    view === current
      ? `${base} bg-primary text-primary-foreground`
      : `${base} text-muted-foreground hover:bg-muted`;
  const aria = (view: DirectoryView) => (view === current ? ("page" as const) : undefined);

  return (
    <nav
      aria-label="Réseau & annuaire"
      className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 md:flex-wrap"
    >
      <Link to="/directory" search={{ vue: "pros" }} className={cls("pros")} aria-current={aria("pros")}>
        Pros
      </Link>
      <Link to="/directory" className={cls("particuliers")} aria-current={aria("particuliers")}>
        Particuliers
      </Link>
      <Link to="/partners" className={cls("partenaires")} aria-current={aria("partenaires")}>
        Partenaires & avantages
      </Link>
      <Link
        to="/directory"
        search={{ vue: "chiens" }}
        className={cls("chiens")}
        aria-current={aria("chiens")}
      >
        Chiens
      </Link>
      {isBureau ? (
        <>
          <Link to="/mairies" className={cls("mairies")} aria-current={aria("mairies")}>
            Mairies & institutions
          </Link>
          <Link to="/members" className={cls("adherents")} aria-current={aria("adherents")}>
            Adhérents (Bureau)
          </Link>
        </>
      ) : null}
    </nav>
  );
}
