import { toast } from "sonner";
import { Check, Copy, ExternalLink, Send, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/domain";
import { explainDbError } from "@/lib/task-lifecycle";
import { COMM_AUDIENCES, COMM_CHANNELS, COMM_STATUSES, canPublishToNews, teamCanEditCommunication } from "@/lib/project-followup";
import type { Communication } from "@/components/CommunicationEditor";

const label = (list: [string, string][], k: string) => list.find(([v]) => v === k)?.[1] ?? k;

/** Carte d'une communication : actions selon l'étape et le rôle (la base reste l'arbitre). */
export function CommunicationCard({
  c,
  ownerName,
  taskTitle,
  projectTitle,
  onEdit,
  onChanged,
}: {
  c: Communication;
  ownerName?: string | undefined;
  taskTitle?: string | undefined;
  projectTitle?: string | undefined;
  onEdit: (c: Communication) => void;
  onChanged: () => void;
}) {
  const { isBureau } = useAuth();
  const canEdit = isBureau ? c.status !== "ARCHIVED" : teamCanEditCommunication(c.status);

  const setStatus = async (status: string, message: string) => {
    const { error } = await supabase.from("bureau_communications").update({ status }).eq("id", c.id);
    if (error) {
      toast.error(explainDbError(error));
      return;
    }
    toast.success(message);
    onChanged();
  };
  const publish = async () => {
    const { error } = await supabase.rpc("publish_communication", { _id: c.id });
    if (error) {
      toast.error(explainDbError(error));
      return;
    }
    toast.success("Publiée dans « Actualités ».");
    onChanged();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`${c.title}\n\n${c.body ?? ""}`.trim());
    toast.success("Texte copié : collez-le dans l'outil de diffusion.");
  };

  return (
    <li className="panel space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{label(COMM_STATUSES, c.status)}</Badge>
        <Badge variant="secondary">{label(COMM_CHANNELS, c.channel)}</Badge>
        <Badge variant="outline">{label(COMM_AUDIENCES, c.target_audience)}</Badge>
        {c.target_date ? <span className="text-xs text-muted-foreground">Prévue le {formatDate(c.target_date)}</span> : null}
      </div>
      <p className="font-medium">{c.title}</p>
      {c.body ? <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">{c.body}</p> : null}
      <p className="text-xs text-muted-foreground">
        {[projectTitle ? `Projet : ${projectTitle}` : null, taskTitle ? `Tâche : ${taskTitle}` : null, `Responsable : ${ownerName ?? "à définir"}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {c.visuals_url ? (
        <a href={c.visuals_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <ExternalLink className="size-3" aria-hidden /> Voir les visuels
        </a>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {canEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(c)}>Modifier</Button> : null}
        {c.status === "DRAFT" ? (
          <Button size="sm" className="gap-1" onClick={() => void setStatus("IN_REVIEW", "Transmise au Bureau pour validation.")}>
            <Send className="size-4" aria-hidden /> Soumettre au Bureau
          </Button>
        ) : null}
        {isBureau && c.status === "IN_REVIEW" ? (
          <>
            <Button size="sm" className="gap-1" onClick={() => void setStatus("READY", "Communication validée.")}>
              <Check className="size-4" aria-hidden /> Valider
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void setStatus("DRAFT", "Renvoyée à l'équipe pour retouches.")}>
              <Undo2 className="size-4" aria-hidden /> À retravailler
            </Button>
          </>
        ) : null}
        {isBureau && canPublishToNews(c) ? (
          <Button size="sm" className="gap-1" onClick={() => void publish()}>
            <Send className="size-4" aria-hidden /> Publier dans Actualités
          </Button>
        ) : null}
        {c.status === "READY" || c.status === "ARCHIVED" ? (
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => void copy()}>
            <Copy className="size-4" aria-hidden /> Copier le texte
          </Button>
        ) : null}
      </div>
    </li>
  );
}
