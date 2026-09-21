import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lightbulb, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { notifyBureau, notifyMembers } from "@/lib/collab-notify";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";

export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({
    meta: [
      { title: "Propositions des professionnels — La Voix du Chien" },
      {
        name: "description",
        content:
          "Les professionnels proposent ateliers, services et idées ; le Bureau les étudie, accepte ou refuse avec un commentaire.",
      },
      { property: "og:title", content: "Propositions des professionnels — La Voix du Chien" },
      {
        property: "og:description",
        content: "Proposez un atelier ou un service à l'association et suivez la réponse du Bureau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProposalsPage,
});

const TYPES = [
  { code: "ATELIER", label: "Atelier / animation" },
  { code: "SERVICE", label: "Service proposé" },
  { code: "PARTENARIAT", label: "Partenariat" },
  { code: "IDEE", label: "Idée d'amélioration" },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REFUSED: "Refusée",
};

type ProposalRow = {
  id: string;
  submitted_by: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  review_comment: string | null;
  created_at: string;
};

function ProposalsPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "ATELIER", title: "", description: "" });
  const [reviewing, setReviewing] = useState<ProposalRow | null>(null);
  const [comment, setComment] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["professional-proposals", isBureau, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_proposals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProposalRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 3) throw new Error("Donnez un titre à votre proposition.");
      const { error } = await supabase.from("professional_proposals").insert({
        submitted_by: user!.id,
        type: form.type,
        title: form.title.trim(),
        description: form.description || null,
        status: "PENDING",
      });
      if (error) throw error;
      await notifyBureau({
        senderId: user?.id,
        kind: "PROPOSAL_SUBMITTED",
        title: "Nouvelle proposition",
        message: form.title.trim(),
        linkUrl: "/proposals",
        entityType: "proposal",
      });
    },
    onSuccess: () => {
      toast.success("Proposition envoyée au Bureau.");
      setOpen(false);
      setForm({ type: "ATELIER", title: "", description: "" });
      void queryClient.invalidateQueries({ queryKey: ["professional-proposals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decide = useMutation({
    mutationFn: async (status: "ACCEPTED" | "REFUSED") => {
      if (!reviewing) return;
      if (comment.trim().length < 5) throw new Error("Expliquez la décision en quelques mots.");
      const { error } = await supabase
        .from("professional_proposals")
        .update({ status, review_comment: comment.trim(), reviewed_by: user?.id ?? null })
        .eq("id", reviewing.id);
      if (error) throw error;
      await notifyMembers({
        recipients: [reviewing.submitted_by],
        senderId: user?.id,
        kind: status === "ACCEPTED" ? "PROPOSAL_ACCEPTED" : "PROPOSAL_REFUSED",
        title: status === "ACCEPTED" ? "Proposition acceptée" : "Proposition refusée",
        message: `${reviewing.title} — ${comment.trim()}`,
        linkUrl: "/proposals",
        entityType: "proposal",
        entityId: reviewing.id,
      });
    },
    onSuccess: () => {
      toast.success("Décision enregistrée.");
      setReviewing(null);
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["professional-proposals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Propositions"
      subtitle="Ateliers, services et idées proposés à l'association"
      actions={
        <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Proposer
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucune proposition"
          message="Proposez un atelier, un service ou une idée : le Bureau vous répondra."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="panel space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">
                  <Lightbulb className="size-4 text-primary" /> {row.title}
                </p>
                <Badge variant={row.status === "PENDING" ? "secondary" : "outline"}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {TYPES.find((t) => t.code === row.type)?.label ?? row.type} ·{" "}
                {new Date(row.created_at).toLocaleDateString("fr-FR")}
              </p>
              {row.description ? (
                <p className="text-sm text-muted-foreground">{row.description}</p>
              ) : null}
              {row.review_comment ? (
                <p className="rounded-md bg-muted p-2 text-xs">
                  Réponse du Bureau : {row.review_comment}
                </p>
              ) : null}
              {isBureau && row.status === "PENDING" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReviewing(row);
                    setComment("");
                  }}
                >
                  Étudier
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title="Nouvelle proposition"
        description="Décrivez ce que vous souhaitez apporter à l'association."
        footer={
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Envoyer au Bureau
          </Button>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="p-type">Type</Label>
            <select
              id="p-type"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="p-title">Titre</Label>
            <Input
              id="p-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
      </SidePanel>

      <SidePanel
        open={Boolean(reviewing)}
        onOpenChange={(value) => {
          if (!value) setReviewing(null);
        }}
        title={reviewing?.title ?? "Proposition"}
        description="Votre réponse est envoyée à la personne qui a proposé."
        footer={
          <>
            <Button variant="outline" onClick={() => decide.mutate("REFUSED")}>
              Refuser
            </Button>
            <Button onClick={() => decide.mutate("ACCEPTED")}>Accepter</Button>
          </>
        }
      >
        <div className="space-y-3">
          {reviewing?.description ? (
            <p className="text-sm text-muted-foreground">{reviewing.description}</p>
          ) : null}
          <div>
            <Label htmlFor="p-comment">Commentaire (obligatoire)</Label>
            <Textarea
              id="p-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
      </SidePanel>
    </AppShell>
  );
}
