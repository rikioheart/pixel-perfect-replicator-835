import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BureauOnly } from "@/components/BureauOnly";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { CONTRIBUTION_STATUS_LABEL, CONTRIBUTION_TYPE_LABEL } from "@/lib/contributions";

export const Route = createFileRoute("/_authenticated/admin/contributions")({
  head: () => ({
    meta: [
      { title: "Propositions d'aide — La Voix du Chien" },
      { name: "description", content: "Le Bureau reçoit et traite les propositions « Je veux aider » et les contributions aux projets." },
      { property: "og:title", content: "Propositions d'aide — La Voix du Chien" },
      { property: "og:description", content: "Traitement des contributions des membres." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminContributions,
});

type Row = {
  id: string; title: string; description: string | null; status: string; contribution_type: string;
  estimated_time: string | null; bureau_reply: string | null; project_id: string | null; user_id: string; created_at: string;
  profiles: { display_name: string | null; first_name: string | null } | null;
  projects: { title: string } | null;
};

const OPEN = ["PROPOSED", "DISCUSSION", "ACCEPTED", "IN_PROGRESS", "BLOCKED"];

function AdminContributions() {
  const { isBureau, user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [sel, setSel] = useState<Row | null>(null);
  const [reply, setReply] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["contributions", "admin"],
    enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*, profiles(display_name,first_name), projects(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const update = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("contributions").update({ status, bureau_reply: reply.trim() || null }).eq("id", sel!.id);
      if (error) throw error;
      await supabase.from("in_app_notifications").insert({
        recipient_id: sel!.user_id, sender_id: user!.id, kind: "CONTRIBUTION_UPDATE",
        title: `Votre proposition : ${CONTRIBUTION_STATUS_LABEL[status]}`, message: reply.trim() || sel!.title,
        link_url: "/parcours", entity_type: "contribution", entity_id: sel!.id,
      });
    },
    onSuccess: () => { toast.success("Proposition mise à jour."); setSel(null); void qc.invalidateQueries({ queryKey: ["contributions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: sel!.title, description: sel!.description, project_id: sel!.project_id,
        assigned_user_id: sel!.user_id, contribution_id: sel!.id, created_by: user!.id, status: "TODO",
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Action créée et reliée à la contribution."),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isBureau) return <BureauOnly title="Propositions d'aide" />;
  const shown = rows.filter((r) => (tab === "open" ? OPEN.includes(r.status) : !OPEN.includes(r.status)));

  return (
    <AppShell title="Propositions d'aide" subtitle="Les membres proposent, le Bureau accompagne">
      <div className="mb-4 flex gap-2" role="group" aria-label="Filtre">
        <Button size="sm" variant={tab === "open" ? "default" : "outline"} aria-pressed={tab === "open"} onClick={() => setTab("open")}>En cours</Button>
        <Button size="sm" variant={tab === "closed" ? "default" : "outline"} aria-pressed={tab === "closed"} onClick={() => setTab("closed")}>Terminées / annulées</Button>
      </div>
      {isLoading ? <LoadingState rows={3} /> : shown.length === 0 ? (
        <EmptyState title="Rien à traiter" message="Les propositions « Je veux aider » arriveront ici." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => (
            <button key={r.id} onClick={() => { setSel(r); setReply(r.bureau_reply ?? ""); }} className="panel p-4 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.profiles?.display_name ?? r.profiles?.first_name ?? "Membre"} · {new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="outline">{CONTRIBUTION_TYPE_LABEL[r.contribution_type]}</Badge>
                <Badge variant="secondary">{CONTRIBUTION_STATUS_LABEL[r.status]}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}
      <SidePanel open={Boolean(sel)} onOpenChange={(o) => !o && setSel(null)} title={sel?.title ?? ""} description="Répondez, faites avancer, ou transformez en action concrète.">
        {sel ? (
          <div className="space-y-4 text-sm">
            <p><span className="text-muted-foreground">Projet :</span> {sel.projects?.title ?? "Non précisé"}</p>
            <p><span className="text-muted-foreground">Temps :</span> {sel.estimated_time ?? "—"}</p>
            {sel.description ? <p className="whitespace-pre-line rounded-md bg-muted/50 p-2">{sel.description}</p> : null}
            <div>
              <Label htmlFor="ct-r">Réponse au membre</Label>
              <Textarea id="ct-r" value={reply} onChange={(e) => setReply(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {["DISCUSSION", "ACCEPTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"].map((s) => (
                <Button key={s} size="sm" variant={s === "ACCEPTED" ? "default" : "outline"} onClick={() => update.mutate(s)} disabled={update.isPending}>
                  {CONTRIBUTION_STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={() => createTask.mutate()} disabled={createTask.isPending}>Créer une action liée</Button>
          </div>
        ) : null}
      </SidePanel>
    </AppShell>
  );
}
