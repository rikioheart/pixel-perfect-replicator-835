import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notifyMembers } from "@/lib/collab-notify";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type CommentEntity = "project" | "task" | "event" | "document" | "activity";

type CommentRow = {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
  profiles: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
};

const ENTITY_LABEL: Record<CommentEntity, string> = {
  project: "le projet",
  task: "la tâche",
  event: "l'événement",
  document: "le document",
  activity: "l'activité",
};

/**
 * Fil de discussion partagé par les personnes concernées (projet, tâche,
 * événement, document). Les participants sont notifiés à chaque message.
 */
export function Comments({
  entityType,
  entityId,
  entityTitle,
  participants = [],
  linkUrl,
}: {
  entityType: CommentEntity;
  entityId: string;
  entityTitle?: string | null;
  participants?: (string | null | undefined)[];
  linkUrl?: string;
}) {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const queryKey = ["comments", entityType, entityId];

  const { data: comments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, body, author_id, created_at, profiles(display_name, first_name, last_name)")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (text.length < 2) throw new Error("Écrivez votre message avant d'envoyer.");
      if (!user?.id) throw new Error("Session expirée, reconnectez-vous.");
      const { error } = await supabase.from("comments").insert({
        entity_type: entityType,
        entity_id: entityId,
        author_id: user.id,
        body: text,
      });
      if (error) throw error;
      await notifyMembers({
        recipients: [...participants, ...comments.map((c) => c.author_id)],
        senderId: user.id,
        kind: "COMMENT_ADDED",
        title: `Nouveau commentaire sur ${ENTITY_LABEL[entityType]}`,
        message: entityTitle ? `${entityTitle} — ${text.slice(0, 120)}` : text.slice(0, 120),
        linkUrl: linkUrl ?? null,
        entityType,
        entityId,
      });
    },
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: (error: Error) => toast.error(error.message),
  });

  const nameOf = (row: CommentRow) =>
    row.profiles?.display_name ||
    `${row.profiles?.first_name ?? ""} ${row.profiles?.last_name ?? ""}`.trim() ||
    "Membre";

  return (
    <section className="panel space-y-4 p-4">
      <h2 className="flex items-center gap-2 text-base font-medium">
        <MessageSquare className="size-4 text-primary" /> Discussion
        <span className="text-xs font-normal text-muted-foreground">
          ({comments.length})
        </span>
      </h2>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des messages…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun message pour l'instant. Lancez la discussion avec l'équipe.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{nameOf(comment)}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  {comment.author_id === user?.id || isBureau ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer le message"
                      className="size-7"
                      onClick={() => remove.mutate(comment.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Textarea
          rows={3}
          aria-label="Votre message"
          placeholder="Partagez une information, posez une question…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
            Envoyer
          </Button>
        </div>
      </div>
    </section>
  );
}
