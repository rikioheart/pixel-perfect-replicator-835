import type { ReactNode } from "react";
import { PawPrint } from "lucide-react";

/** État vide chaleureux : une illustration douce et un encouragement, jamais une page blanche. */
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-accent/40 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <PawPrint className="size-6" />
      </span>
      <p className="font-display text-base">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
