import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { decisionTaskMarker } from "@/lib/governance";
import { formatParisDateTime } from "@/lib/places";
import { humanizeError } from "@/lib/user-messages";

type Rec = { id: string; title: string; decisions: string | null; meeting_at: string | null; meeting_date: string };

/** Prépare un brouillon dans l'espace Communication à partir d'une décision (aucune publication automatique). */
export function DecisionToCommunication({ record }: { record: Rec }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const marker = decisionTaskMarker(record.id);

  const { data: linked = [] } = useQuery({
    queryKey: ["decision-comms", record.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bureau_communications").select("id,title").ilike("internal_notes", `%${marker}%`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bureau_communications").insert({
        title: `Annonce : ${record.title}`.slice(0, 160),
        body: record.decisions,
        status: "DRAFT",
        channel: "INTERNAL_WALL",
        target_audience: "ALL_MEMBERS",
        internal_notes: `Issue de : ${record.title} (${formatParisDateTime(record.meeting_at ?? record.meeting_date)}) ${marker}`,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Brouillon créé dans Communication, à relire avant diffusion.");
      void qc.invalidateQueries({ queryKey: ["decision-comms", record.id] });
      void qc.invalidateQueries({ queryKey: ["bureau-communications"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("row-level") ? "Réservé au Bureau." : humanizeError(e)),
  });

  if (!record.decisions?.trim()) return null;
  if (linked.length > 0) {
    return <Link to="/admin/communication" className="text-xs underline underline-offset-2">Brouillon de communication prêt</Link>;
  }
  return (
    <Button size="sm" variant="outline" onClick={() => create.mutate()} disabled={create.isPending}>
      <Megaphone className="mr-1 size-3.5" aria-hidden />Préparer une communication
    </Button>
  );
}
