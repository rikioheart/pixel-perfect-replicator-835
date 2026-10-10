import type { ReactNode } from "react";
import illustration from "@/assets/illustration-empty.jpg";

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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-8 text-center">
      <img
        src={illustration}
        alt=""
        aria-hidden
        loading="lazy"
        width={992}
        height={672}
        className="h-auto w-full max-w-[220px] rounded-lg mix-blend-multiply"
      />
      <p className="font-display text-base">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
