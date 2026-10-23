import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type Kind = "project" | "activity" | "event";

/** Mairies et établissements identifiés sur un projet, une activité ou un événement (ajout réservé au Bureau). */
export function LinkedMairies({ type, id }: { type: Kind; id: string }) {
  const { isBureau } = useAuth() as { isBureau?: boolean };
  const qc = useQueryClient();
  const key = ["linked-mairies", type, id];
  const [pick, setPick] = useState("");
  const { data: linked = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("linked_mairies", { _type: type, _id: id });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: all = [] } = useQuery({
    queryKey: ["mairies-options"],
    enabled: !!isBureau,
    queryFn: async () => {
      const { data } = await supabase.from("mairies").select("id, organization, city").order("organization");
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("entity_mairies").insert({ mairie_id: pick, entity_type: type, entity_id: id });
      if (error) throw error;
    },
    onSuccess: () => { setPick(""); qc.invalidateQueries({ queryKey: key }); toast.success("Établissement identifié"); },
    onError: () => toast.error("Ajout impossible"),
  });
  const remove = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("entity_mairies").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  if (!linked.length && !isBureau) return null;
  const free = all.filter((m) => !linked.some((l) => l.mairie_id === m.id));
  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-center gap-2 font-medium"><Landmark className="size-4 text-muted-foreground" aria-hidden /> Mairies et établissements</p>
      {linked.length ? (
        <ul className="flex flex-wrap gap-2">
          {linked.map((l) => (
            <li key={l.link_id} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
              {l.name}{l.city ? ` · ${l.city}` : ""}
              {isBureau ? (
                <button type="button" aria-label={`Retirer ${l.name}`} onClick={() => remove.mutate(l.link_id)} className="ml-1 rounded hover:bg-accent">
                  <X className="size-3" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted-foreground">Aucun établissement identifié.</p>}
      {isBureau && free.length ? (
        <div className="flex flex-wrap gap-2">
          <select aria-label="Choisir une mairie ou un établissement" value={pick} onChange={(e) => setPick(e.target.value)}
            className="min-h-9 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">Choisir…</option>
            {free.map((m) => <option key={m.id} value={m.id}>{m.organization}{m.city ? ` · ${m.city}` : ""}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={!pick || add.isPending} onClick={() => add.mutate()}>Identifier</Button>
        </div>
      ) : null}
    </div>
  );
}
