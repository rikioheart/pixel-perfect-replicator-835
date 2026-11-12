import type { ReactNode } from "react";
import { DogEmptyArt, type DogArt } from "@/components/DogEmptyArt";

/**
 * État vide chaleureux : un petit chien dessiné et un encouragement, jamais une page blanche.
 * `art` suit le contexte : "attentive" pour une recherche ou une ressource, "resting" pour un
 * espace calme ou tout traité, "playful" pour les idées et l'entraide, "none" sans dessin.
 */
export function EmptyState({
  title,
  message,
  action,
  art = "attentive",
}: {
  title: string;
  message: string;
  action?: ReactNode;
  art?: DogArt | "none";
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-8 text-center">
      {art === "none" ? null : <DogEmptyArt art={art} className="h-auto w-full max-w-[200px]" />}
      <p className="font-display text-base">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
