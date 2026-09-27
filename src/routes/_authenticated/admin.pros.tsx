import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BureauOnly } from "@/components/BureauOnly";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PRO_STATUS_LABEL } from "@/lib/pro-card";

export const Route = createFileRoute("/_authenticated/admin/pros")({
  head: () => ({
    meta: [
      { title: "Fiches professionnelles — La Voix du Chien" },
      { name: "description", content: "Validation des cartes professionnelles et données de partenariat internes." },
      { property: "og:title", content: "Fiches professionnelles — La Voix du Chien" },
      { property: "og:description", content: "Espace Bureau : validation des cartes professionnelles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPros,
});

type Card = { id: string; profile_id: string; display_name: string; slug: string; status: string; sector: string | null; review_comment: string | null };

function AdminPros() {
  const { isBureau } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("PENDING_REVIEW");
  const [edit, setEdit] = useState<Card | null>(null);
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState({ contract_url: "", partnership_percentage: "0", internal_notes: "" });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["admin-pro-cards"],
    enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase.from("professional_public_profile").select("id,profile_id,display_name,slug,status,sector,review_comment").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Card[];
    },
  });

  const open = async (c: Card) => {
    setEdit(c);
    setComment(c.review_comment ?? "");
    const { data } = await supabase.from("professional_internal_details").select("*").eq("profile_id", c.profile_id).maybeSingle();
    setInternal({
      contract_url: data?.contract_url ?? "",
      partnership_percentage: String(data?.partnership_percentage ?? 0),
      internal_notes: data?.internal_notes ?? "",
    });
  };

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!edit) return;
      if (status !== "ACTIVE" && comment.trim().length < 5) throw new Error("Ajoutez un message expliquant la décision.");
      const { error } = await supabase.from("professional_public_profile").update({ status, review_comment: comment.trim() || null }).eq("id", edit.id);
      if (error) throw error;
      await supabase.from("in_app_notifications").insert({
        recipient_id: edit.profile_id, kind: "PRO_CARD_REVIEW",
        title: status === "ACTIVE" ? "Carte professionnelle publiée" : "Carte professionnelle : " + PRO_STATUS_LABEL[status],
        message: comment.trim() || null, link_url: "/espace-pro/carte", entity_type: "pro_card", entity_id: edit.id,
      });
    },
    onSuccess: () => { toast.success("Statut mis à jour."); setEdit(null); void qc.invalidateQueries({ queryKey: ["admin-pro-cards"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveInternal = useMutation({
    mutationFn: async () => {
      if (!edit) return;
      const { error } = await supabase.from("professional_internal_details").upsert({
        profile_id: edit.profile_id, contract_url: internal.contract_url.trim() || null,
        partnership_percentage: Number(internal.partnership_percentage) || 0, internal_notes: internal.internal_notes.trim() || null,
      }, { onConflict: "profile_id" });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Données internes enregistrées."),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isBureau) return <BureauOnly title="Fiches professionnelles" />;
  const shown = filter === "ALL" ? cards : cards.filter((c) => c.status === filter);

  return (
    <AppShell title="Fiches professionnelles" subtitle="Validez les cartes avant publication, gérez les données internes">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {["PENDING_REVIEW", "ACTIVE", "DRAFT", "SUSPENDED", "ALL"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {s === "ALL" ? "Toutes" : PRO_STATUS_LABEL[s]} ({s === "ALL" ? cards.length : cards.filter((c) => c.status === s).length})
          </Button>
        ))}
      </div>
      {isLoading ? <LoadingState rows={3} /> : shown.length === 0 ? (
        <EmptyState title="Rien à traiter" message="Aucune carte dans cette catégorie." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((c) => (
            <button key={c.id} onClick={() => void open(c)} className="panel p-4 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="font-medium">{c.display_name}</p>
              <p className="text-xs text-muted-foreground">/professionnels/{c.slug}{c.sector ? ` · ${c.sector}` : ""}</p>
              <Badge variant="secondary" className="mt-2">{PRO_STATUS_LABEL[c.status]}</Badge>
            </button>
          ))}
        </div>
      )}

      <SidePanel open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)} title={edit?.display_name ?? ""} description="Décision de publication et données internes (jamais visibles publiquement).">
        {edit ? (
          <div className="space-y-5 text-sm">
            <Link to="/professionals/$proId" params={{ proId: edit.profile_id }} className="underline">Voir la fiche interne</Link>
            <div className="space-y-2">
              <Label htmlFor="rv-c">Message au professionnel</Label>
              <Textarea id="rv-c" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setStatus.mutate("ACTIVE")}>Publier</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus.mutate("DRAFT")}>Renvoyer en brouillon</Button>
                <Button size="sm" variant="destructive" onClick={() => setStatus.mutate("SUSPENDED")}>Suspendre</Button>
              </div>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="font-medium">Données internes</h3>
              <div><Label htmlFor="in-c">Contrat (lien)</Label><Input id="in-c" value={internal.contract_url} onChange={(e) => setInternal({ ...internal, contract_url: e.target.value })} /></div>
              <div><Label htmlFor="in-p">Pourcentage de partenariat</Label><Input id="in-p" type="number" min="0" max="100" value={internal.partnership_percentage} onChange={(e) => setInternal({ ...internal, partnership_percentage: e.target.value })} /></div>
              <div><Label htmlFor="in-n">Notes internes</Label><Textarea id="in-n" value={internal.internal_notes} onChange={(e) => setInternal({ ...internal, internal_notes: e.target.value })} /></div>
              <Button size="sm" onClick={() => saveInternal.mutate()}>Enregistrer</Button>
            </div>
          </div>
        ) : null}
      </SidePanel>
    </AppShell>
  );
}
