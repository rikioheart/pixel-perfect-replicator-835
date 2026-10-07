import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type PeekType = "dog" | "project" | "activity" | "reservation" | "task" | "person";
type Peek = { title?: string; subtitle?: string; status?: string; can_open?: boolean; link?: string;
  indicators?: { family: string; label: string }[] };

const FAMILY: Record<string, { icon: string; cls: string }> = {
  VERT: { icon: "●", cls: "text-primary" }, JAUNE: { icon: "▲", cls: "text-foreground" },
  BLEU: { icon: "■", cls: "text-foreground" }, NOIR: { icon: "◆", cls: "text-foreground" },
};

/** Petite fenêtre contextuelle : n'affiche que ce que la base autorise (entity_peek). */
export function EntityPeek({ type, id, children }: { type: PeekType; id: string; children: ReactNode }) {
  const q = useQuery({
    queryKey: ["peek", type, id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("entity_peek", { _type: type, _id: id });
      if (error) throw error;
      return data as Peek | null;
    },
  });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="underline-offset-2 hover:underline focus-visible:underline">{children}</button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm">
        {q.isLoading ? <p className="text-muted-foreground">Chargement…</p> : !q.data ? (
          <p className="text-muted-foreground">Informations non disponibles pour vous.</p>
        ) : (
          <div className="space-y-2">
            <p className="font-medium">{q.data.title}</p>
            {q.data.subtitle ? <p className="text-xs text-muted-foreground">{q.data.subtitle}</p> : null}
            {q.data.indicators?.length ? (
              <ul className="space-y-1">
                {q.data.indicators.map((i, n) => (
                  <li key={n} className="flex items-center gap-2 text-xs">
                    <span aria-hidden className={FAMILY[i.family]?.cls}>{FAMILY[i.family]?.icon}</span>
                    <span>{i.label}</span><span className="sr-only">({i.family})</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {q.data.can_open && q.data.link ? (
              <Link to={q.data.link} className="text-xs font-medium text-primary hover:underline">Ouvrir la fiche</Link>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
