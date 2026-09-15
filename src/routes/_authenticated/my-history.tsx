import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/my-history")({
  head: () => ({
    meta: [
      { title: "Mon historique — La Voix du Chien" },
      {
        name: "description",
        content: "Le journal de vos actions dans l'association : la mémoire de votre engagement.",
      },
      { property: "og:title", content: "Mon historique — La Voix du Chien" },
      {
        property: "og:description",
        content: "Retrouvez toutes vos contributions, dans l'ordre, avec leur date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyHistoryPage,
});

function MyHistoryPage() {
  const { user, isBureau } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-history", user?.id, isBureau],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      let request = supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!isBureau) request = request.eq("actor_id", user!.id);
      const { data } = await request;
      return data ?? [];
    },
  });

  return (
    <AppShell
      title="Mon historique"
      subtitle={
        isBureau
          ? "L'ensemble des actions tracées, les vôtres comme celles du réseau."
          : "Toutes vos actions restent tracées : c'est la mémoire de votre engagement."
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement de votre historique…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="Aucune action enregistrée"
          message="Dès votre première contribution, tout apparaîtra ici."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((log) => (
            <li
              key={log.id}
              className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-primary/40"
            >
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <History className="size-4 text-primary" />
                {log.action}
                {log.entity_type ? ` · ${log.entity_type}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString("fr-FR")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
