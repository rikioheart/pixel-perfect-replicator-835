import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { memberFullName } from "@/lib/members";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Journal d'activité — La Voix du Chien" },
      {
        name: "description",
        content:
          "Traçabilité complète des actions du cockpit : créations, modifications, rattachements et habilitations.",
      },
      { property: "og:title", content: "Journal d'activité — La Voix du Chien" },
      {
        property: "og:description",
        content: "Historique horodaté des actions réalisées par les membres et le Bureau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

const ACTION_LABEL: Record<string, string> = {
  "project.create": "Création de projet",
  "project.update": "Modification de projet",
  "project.delete": "Suppression de projet",
  "project.link": "Rattachement de projet",
  "task.create": "Création de tâche",
  "task.update": "Modification de tâche",
  "task.link": "Rattachement de tâche",
  "role.assign": "Attribution de rôle",
  "role.revoke": "Retrait de rôle",
  "action.undo": "Annulation d'action",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditPage() {
  const { isBureau } = useAuth();
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("ALL");

  const { data: logs } = useQuery({
    queryKey: ["audit-logs"],
    enabled: isBureau,
    queryFn: async () =>
      (
        await supabase
          .from("audit_logs")
          .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(300)
      ).data ?? [],
  });

  const { data: actors } = useQuery({
    queryKey: ["audit-actors"],
    enabled: isBureau,
    queryFn: async () =>
      (await supabase.from("profiles").select("id, display_name, first_name, last_name, email"))
        .data ?? [],
  });

  const actorName = (id: string | null) => {
    if (!id) return "Système";
    const actor = (actors ?? []).find((a) => a.id === id);
    return actor ? memberFullName(actor) : "Utilisateur";
  };

  const entityTypes = useMemo(
    () =>
      Array.from(new Set((logs ?? []).map((l) => l.entity_type).filter(Boolean))) as string[],
    [logs],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (logs ?? []).filter((log) => {
      if (entity !== "ALL" && log.entity_type !== entity) return false;
      if (!term) return true;
      const label = ACTION_LABEL[log.action] ?? log.action;
      return `${label} ${log.action} ${actorName(log.actor_id)} ${JSON.stringify(
        log.metadata ?? {},
      )}`
        .toLowerCase()
        .includes(term);
    });
  }, [logs, search, entity, actors]);

  if (!isBureau) {
    return (
      <AppShell title="Journal d'activité" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Cette page est réservée aux membres du Bureau.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Journal d'activité"
      subtitle="Traçabilité des actions sur les projets, tâches et habilitations"
      actions={
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher"
            className="w-48"
          />
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les entités</SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {filtered.map((log) => {
          const meta = (log.metadata ?? {}) as Record<string, unknown>;
          const title = typeof meta["title"] === "string" ? (meta["title"] as string) : null;
          return (
            <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {ACTION_LABEL[log.action] ?? log.action}
                  {title ? <span className="text-muted-foreground"> — {title}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {actorName(log.actor_id)} · {formatDateTime(log.created_at)}
                </p>
              </div>
              {log.entity_type ? <Badge variant="outline">{log.entity_type}</Badge> : null}
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucune action enregistrée.</p>
        ) : null}
      </div>
    </AppShell>
  );
}

export default AuditPage;
