import { cn } from "@/lib/utils";

/** Libellé commun : court, rassurant, annoncé aux lecteurs d'écran. */
export const DEFAULT_LOADING_LABEL = "Un instant, nous rassemblons les informations…";

/**
 * État de chargement cohérent et accessible : annoncé aux lecteurs d'écran
 * via role="status", visuellement représenté par des lignes grisées.
 */
export function LoadingState({
  label = DEFAULT_LOADING_LABEL,
  rows = 3,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-md bg-muted"
          style={{ opacity: 1 - index * 0.12 }}
        />
      ))}
    </div>
  );
}

/** Variante compacte, pour les zones en ligne (listes courtes, panneaux). */
export function InlineLoading({ label = DEFAULT_LOADING_LABEL }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
      {label}
    </p>
  );
}
