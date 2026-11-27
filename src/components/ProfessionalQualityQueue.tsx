import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";
import { PROFESSIONAL_QUALITY_LABEL } from "@/lib/professional-quality";
import { humanizeError } from "@/lib/user-messages";

type QualityRow = { profile_id: string; company_name: string | null; professional_category: string | null; pro_status: string; pro_review_note: string | null; profiles: { display_name: string | null; first_name: string | null; last_name: string | null } | null };

export function ProfessionalQualityQueue() {
  const { user, isBureau } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<QualityRow | null>(null);
  const [note, setNote] = useState("");
  const query = useQuery({
    queryKey: ["professional-quality-queue", user?.id], enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase.from("pro_details").select("profile_id,company_name,professional_category,pro_status,pro_review_note,profiles(display_name,first_name,last_name)").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as QualityRow[];
    },
  });
  const decide = useMutation({
    mutationFn: async (status: string) => {
      if (!selected) return;
      const { error } = await supabase.rpc("decide_professional_quality", { _profile_id: selected.profile_id, _status: status, _note: note.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Décision enregistrée. Le membre peut se reconnecter pour retrouver ses accès à jour.");
      setSelected(null);
      for (const key of ["professional-quality-queue", "member-options", "directory", "my-permissions"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (error: Error) => toast.error(humanizeError(error)),
  });
  if (!isBureau) return null;
  return (
    <section className="mb-6 space-y-3 border-b border-border pb-6">
      <h2 className="font-display text-lg">Qualités professionnelles</h2>
      {query.isError ? <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Réessayer</Button> : query.isPending ? <p role="status" className="text-sm text-muted-foreground">Chargement…</p> : query.data.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande professionnelle.</p> : (
        <div className="divide-y divide-border">
          {query.data.map((row) => (
            <div key={row.profile_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="break-words font-medium">{row.profiles?.display_name || [row.profiles?.first_name, row.profiles?.last_name].filter(Boolean).join(" ") || row.company_name}</p><p className="text-sm text-muted-foreground">{row.company_name}{row.professional_category ? ` · ${row.professional_category}` : ""}</p></div>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{PROFESSIONAL_QUALITY_LABEL[row.pro_status]}</Badge><Button size="sm" variant="outline" disabled={row.profile_id === user?.id} onClick={() => { setSelected(row); setNote(row.pro_review_note ?? ""); }}>Examiner</Button></div>
            </div>
          ))}
        </div>
      )}
      <SidePanel open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.company_name ?? "Qualité professionnelle"} description="Cette décision concerne les outils professionnels, pas la publication de la carte publique.">
        <div className="space-y-4"><div><Label htmlFor="pq-review">Message au membre (obligatoire en cas de refus ou suspension)</Label><Textarea id="pq-review" value={note} onChange={(event) => setNote(event.target.value)} /></div><div className="flex flex-wrap gap-2"><Button disabled={decide.isPending} onClick={() => decide.mutate("VALIDATED")}>Valider</Button><Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate("REFUSED")}>Ne pas retenir</Button><Button variant="destructive" disabled={decide.isPending} onClick={() => decide.mutate("SUSPENDED")}>Suspendre</Button></div></div>
      </SidePanel>
    </section>
  );
}