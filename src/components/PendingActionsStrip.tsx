import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { pendingActions, type PendingAction } from "@/lib/role-home";

/**
 * « À traiter maintenant » : seules les files qui attendent une décision humaine, chacune vers son écran.
 * Rien à traiter = une phrase calme, pas une grille de zéros.
 */
export function PendingActionsStrip({
  title = "À traiter maintenant",
  items,
  loading = false,
  calmMessage = "Rien n'attend votre décision pour le moment. Merci !",
}: {
  title?: string;
  items: PendingAction[];
  loading?: boolean;
  calmMessage?: string;
}) {
  const shown = pendingActions(items);
  return (
    <section className="panel p-4" aria-labelledby="pending-actions-title">
      <h2 id="pending-actions-title" className="mb-3 font-display text-lg">{title}</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : shown.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" aria-hidden /> {calmMessage}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => {
            const body = (
              <>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 rounded-full bg-warning px-2 py-0.5 text-xs font-semibold text-warning-foreground">
                  {item.count ?? "—"}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </>
            );
            const cls =
              "flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
            return (
              <li key={item.key}>
                {item.to.startsWith("#") ? (
                  <a href={item.to} className={cls}>{body}</a>
                ) : (
                  <Link to={item.to} search={item.search as never} className={cls}>{body}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
