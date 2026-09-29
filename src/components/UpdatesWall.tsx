import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { UPDATE_KIND_LABEL } from "@/lib/contributions";

/** « Ce que nous construisons ensemble » — jamais de score ni de classement. */
export function UpdatesWall({ limit = 6, publicOnly = false, compact = false }: { limit?: number; publicOnly?: boolean; compact?: boolean }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["association-updates", publicOnly, limit],
    queryFn: async () => {
      let q = supabase.from("association_updates").select("id,kind,title,body,created_at,is_public").order("created_at", { ascending: false }).limit(limit);
      if (publicOnly) q = q.eq("is_public", true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  if (rows.length === 0 && compact) return null;
  return (
    <section className="panel space-y-3 p-5" aria-labelledby="wall-title">
      <h2 id="wall-title" className="flex items-center gap-2 font-display text-lg">
        <Sparkles className="size-4 text-primary" aria-hidden /> Ce que nous construisons ensemble
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Les premières avancées seront bientôt partagées ici.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-border pb-3 text-sm last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{UPDATE_KIND_LABEL[r.kind]}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</span>
              </div>
              <p className="mt-1 font-medium">{r.title}</p>
              {r.body && !compact ? <p className="text-muted-foreground">{r.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
