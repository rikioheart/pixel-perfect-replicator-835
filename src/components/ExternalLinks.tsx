import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { defaultTitle, detectService, normalizeUrl, SERVICE_LABEL, type ServiceKey } from "@/lib/external-links";

export type LinkContext = "PROJECT" | "ACTIVITY" | "EVENT" | "TASK" | "RESERVATION" | "FORMATION" | "MEETING";

/**
 * Ressources externes d'un contexte : coller un lien, l'ouvrir. Stockées dans `documents`
 * (url + contexte + sensibilité), aucune synchronisation, aucun appel au service externe.
 */
export function ExternalLinks({ contextType, contextId, title = "Ressources et liens" }:
  { contextType: LinkContext; contextId: string; title?: string }) {
  const { user, isBureau } = useAuth();
  const qc = useQueryClient();
  const key = ["external-links", contextType, contextId];
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [sensitivity, setSensitivity] = useState("INTERNE");

  const { data: links = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("id, title, url, service, sensitivity, uploaded_by")
        .eq("context_type", contextType).eq("context_id", contextId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const { data: canAdd = false } = useQuery({
    queryKey: ["can-add-resource", contextType, contextId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("can_add_context_resource", { _user_id: user!.id, _type: contextType, _id: contextId });
      return Boolean(data);
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const clean = normalizeUrl(url);
      if (!clean) throw new Error("Ce lien n'est pas valide.");
      const { error } = await supabase.from("documents").insert({
        title: label.trim() || defaultTitle(clean), url: clean, service: detectService(clean),
        context_type: contextType, context_id: contextId, sensitivity, visibility: "ASSOCIATION",
        category: "LIEN_EXTERNE", uploaded_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setUrl(""); setLabel(""); setAdding(false); toast.success("Lien ajouté."); void qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message.includes("row-level") ? "Vous ne pouvez pas ajouter de lien ici." : e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = normalizeUrl(url);

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby={`links-${contextId}`}>
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-primary" aria-hidden />
        <h2 id={`links-${contextId}`} className="flex-1 font-semibold">{title}</h2>
        {canAdd && !adding && <Button size="sm" variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setAdding(true)}><Plus className="mr-1 size-3.5" />Ajouter une ressource</Button>}
      </div>

      {adding && (
        <form className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div><Label htmlFor={`lk-url-${contextId}`} className="sr-only">Lien</Label>
            <Input id={`lk-url-${contextId}`} autoFocus inputMode="url" placeholder="Collez un lien (Drive, Forms, Meet, Rintintin…)" value={url} onChange={(e) => setUrl(e.target.value)} />
            {preview && <p className="mt-1 text-xs text-muted-foreground">Reconnu : {SERVICE_LABEL[detectService(preview)]}</p>}</div>
          <div><Label htmlFor={`lk-t-${contextId}`} className="sr-only">Titre (facultatif)</Label>
            <Input id={`lk-t-${contextId}`} placeholder="Titre (facultatif)" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div><Label htmlFor={`lk-s-${contextId}`} className="sr-only">Sensibilité</Label>
            <select id={`lk-s-${contextId}`} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={sensitivity} onChange={(e) => setSensitivity(e.target.value)}>
              <option value="PUBLIC">Public</option><option value="INTERNE">Interne</option>
              {isBureau && <option value="SENSIBLE">Sensible</option>}
            </select></div>
          <div className="flex gap-1">
            <Button type="submit" disabled={!url || add.isPending}>Enregistrer</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </form>
      )}

      {isLoading ? <p role="status" className="mt-2 text-sm text-muted-foreground">Chargement…</p> : links.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucun lien pour l'instant.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {links.map((l) => {
            const s = (l.service ?? detectService(l.url)) as ServiceKey;
            return (
              <li key={l.id} className="flex items-center gap-2">
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate font-medium">{l.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{SERVICE_LABEL[s] ?? "Lien externe"}{l.sensitivity === "SENSIBLE" ? " · sensible" : ""}</span>
                  <span className="sr-only">(s'ouvre dans un nouvel onglet)</span>
                </a>
                {(l.uploaded_by === user?.id || isBureau) && (
                  <Button size="icon" variant="ghost" aria-label={`Retirer ${l.title}`} onClick={() => remove.mutate(l.id)}><Trash2 className="size-4" /></Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">L'accès au contenu reste contrôlé par le service externe.</p>
    </section>
  );
}
