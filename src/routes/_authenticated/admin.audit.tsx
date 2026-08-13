import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          "Traçabilité complète des actions du cockpit : créations, modifications, suppressions, rattachements et habilitations.",
      },
      { property: "og:title", content: "Journal d'activité — La Voix du Chien" },
      {
        property: "og:description",
        content: "Historique horodaté, filtrable et paginé des actions réalisées dans le cockpit.",
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
  "task.status": "Changement de statut de tâche",
  "task.link": "Rattachement de tâche",
  "role.assign": "Attribution de rôle",
  "role.revoke": "Retrait de rôle",
  "function.assign": "Attribution de fonction",
  "function.revoke": "Clôture de fonction",
  "project.create.undo": "Annulation — création de projet",
  "project.update.undo": "Annulation — modification de projet",
  "project.delete.undo": "Annulation — suppression de projet",
  "project.link.undo": "Annulation — rattachement de projet",
  "task.create.undo": "Annulation — création de tâche",
  "task.link.undo": "Annulation — rattachement de tâche",
  "action.undo": "Annulation d'action",
};

const CATEGORY_OF_ACTION = (action: string): string => {
  if (action.endsWith(".undo")) return "UNDO";
  if (action.startsWith("project.")) return "PROJET";
  if (action.startsWith("task.")) return "TACHE";
  if (action.startsWith("role.") || action.startsWith("function.")) return "HABILITATION";
  return "AUTRE";
};

const CATEGORY_LABEL: Record<string, string> = {
  PROJET: "Projets",
  TACHE: "Tâches",
  HABILITATION: "Habilitations",
  UNDO: "Annulations",
  AUTRE: "Autres",
};

const PAGE_SIZE = 20;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type LogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  metadata: unknown;
  created_at: string;
};

function AuditPage() {
  const { isBureau } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [actor, setActor] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("ALL");
  const [chronological, setChronological] = useState(false);

  const { data: logs } = useQuery({
    queryKey: ["audit-logs"],
    enabled: isBureau,
    queryFn: async () =>
      ((
        await supabase
          .from("audit_logs")
          .select(
            "id, actor_id, action, entity_type, entity_id, old_values, new_values, metadata, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(1000)
      ).data ?? []) as LogRow[],
  });

  const { data: actors } = useQuery({
    queryKey: ["audit-actors"],
    enabled: isBureau,
    queryFn: async () =>
      (await supabase.from("profiles").select("id, display_name, first_name, last_name, email"))
        .data ?? [],
  });

  const { data: projects } = useQuery({
    queryKey: ["audit-projects"],
    enabled: isBureau,
    queryFn: async () => (await supabase.from("projects").select("id, title")).data ?? [],
  });

  const { data: tasks } = useQuery({
    queryKey: ["audit-tasks"],
    enabled: isBureau,
    queryFn: async () =>
      (await supabase.from("tasks").select("id, title, project_id")).data ?? [],
  });

  const actorName = (id: string | null) => {
    if (!id) return "Système";
    const found = (actors ?? []).find((a) => a.id === id);
    return found ? memberFullName(found) : "Utilisateur";
  };

  const projectTitle = (id: string | null) =>
    id ? ((projects ?? []).find((p) => p.id === id)?.title ?? null) : null;

  const taskOf = (id: string | null) =>
    id ? ((tasks ?? []).find((t) => t.id === id) ?? null) : null;

  const actionTypes = useMemo(
    () => Array.from(new Set((logs ?? []).map((l) => l.action))).sort(),
    [logs],
  );

  /** Tous les identifiants d'entités (projet ou tâche) référencés par une entrée. */
  const relatedIds = (log: LogRow): string[] => {
    const bags = [log.metadata, log.new_values, log.old_values] as Array<
      Record<string, unknown> | null
    >;
    const ids = new Set<string>();
    if (log.entity_id) ids.add(log.entity_id);
    for (const bag of bags) {
      if (!bag || typeof bag !== "object") continue;
      for (const key of ["project_id", "parent_project_id", "task_id", "target_id", "source_id"]) {
        const value = (bag as Record<string, unknown>)[key];
        if (typeof value === "string") ids.add(value);
      }
    }
    return Array.from(ids);
  };

  /** Entité principale de l'entrée, pour la navigation directe. */
  const entityRefOf = (log: LogRow) => {
    for (const id of relatedIds(log)) {
      const task = taskOf(id);
      if (task) return { value: `T:${id}`, label: task.title, kind: "task" as const, id };
      const title = projectTitle(id);
      if (title) return { value: `P:${id}`, label: title, kind: "project" as const, id };
    }
    return null;
  };

  const contextOf = (log: LogRow) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const next = (log.new_values ?? {}) as Record<string, unknown>;
    const prev = (log.old_values ?? {}) as Record<string, unknown>;
    const summary =
      (typeof meta["summary"] === "string" && meta["summary"]) ||
      (typeof meta["title"] === "string" && meta["title"]) ||
      (typeof next["title"] === "string" && (next["title"] as string)) ||
      (typeof prev["title"] === "string" && (prev["title"] as string)) ||
      null;
    const parts: string[] = [];
    const linkedProject = projectTitle(log.entity_id);
    if (linkedProject) parts.push(`Projet : ${linkedProject}`);
    const linkedTask = taskOf(log.entity_id);
    if (linkedTask) parts.push(`Tâche : ${linkedTask.title}`);
    if (typeof next["status"] === "string")
      parts.push(
        `Statut : ${typeof prev["status"] === "string" ? `${prev["status"]} → ` : ""}${next["status"]}`,
      );
    if (typeof next["parent_project_id"] === "string")
      parts.push(`Lien vers : ${projectTitle(next["parent_project_id"] as string) ?? "projet"}`);
    if (typeof next["task_id"] === "string") parts.push("Lien de tâche");
    return { summary: summary as string | null, context: parts };
  };

  /** Identifiants acceptés pour le filtre entité sélectionné. */
  const entityScope = useMemo(() => {
    if (entity === "ALL") return null;
    const [kind, id] = [entity.slice(0, 1), entity.slice(2)];
    if (kind === "T") return new Set([id]);
    const childTaskIds = (tasks ?? []).filter((t) => t.project_id === id).map((t) => t.id);
    return new Set([id, ...childTaskIds]);
  }, [entity, tasks]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const rows = (logs ?? []).filter((log) => {
      if (category !== "ALL" && CATEGORY_OF_ACTION(log.action) !== category) return false;
      if (action !== "ALL" && log.action !== action) return false;
      if (actor !== "ALL" && (log.actor_id ?? "SYSTEM") !== actor) return false;
      if (entityScope && !relatedIds(log).some((id) => entityScope.has(id))) return false;
      const time = new Date(log.created_at).getTime();
      if (fromTime && time < fromTime) return false;
      if (toTime && time > toTime) return false;
      if (!term) return true;
      const { summary, context } = contextOf(log);
      return `${ACTION_LABEL[log.action] ?? log.action} ${log.action} ${actorName(
        log.actor_id,
      )} ${summary ?? ""} ${context.join(" ")}`
        .toLowerCase()
        .includes(term);
    });
    return rows.sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return chronological ? diff : -diff;
    });
  }, [
    logs,
    search,
    category,
    action,
    actor,
    from,
    to,
    actors,
    projects,
    tasks,
    entityScope,
    chronological,
  ]);

  useEffect(() => {
    setPage(1);
  }, [search, category, action, actor, from, to, entity, chronological]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetFilters = () => {
    setSearch("");
    setCategory("ALL");
    setAction("ALL");
    setActor("ALL");
    setFrom("");
    setTo("");
    setEntity("ALL");
  };

  const entityLabel =
    entity === "ALL"
      ? null
      : entity.startsWith("T:")
        ? (taskOf(entity.slice(2))?.title ?? "Tâche")
        : (projectTitle(entity.slice(2)) ?? "Projet");

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
      subtitle="Traçabilité des actions sur les projets, tâches, liens et habilitations"
    >
      <div className="mb-4 grid gap-2 rounded-lg border border-border bg-card p-4 md:grid-cols-3 lg:grid-cols-6">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (projet, tâche, auteur…)"
          className="lg:col-span-2"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes catégories</SelectItem>
            {Object.entries(CATEGORY_LABEL).map(([code, label]) => (
              <SelectItem key={code} value={code}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger>
            <SelectValue placeholder="Type d'action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem>
            {actionTypes.map((code) => (
              <SelectItem key={code} value={code}>
                {ACTION_LABEL[code] ?? code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger>
            <SelectValue placeholder="Utilisateur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les utilisateurs</SelectItem>
            <SelectItem value="SYSTEM">Système</SelectItem>
            {(actors ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {memberFullName(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {filtered.length} action{filtered.length > 1 ? "s" : ""} trouvée
          {filtered.length > 1 ? "s" : ""}
        </span>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Réinitialiser les filtres
        </Button>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {pageRows.map((log) => {
          const { summary, context } = contextOf(log);
          return (
            <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {ACTION_LABEL[log.action] ?? log.action}
                  {summary ? <span className="text-muted-foreground"> — {summary}</span> : null}
                </p>
                {context.length > 0 ? (
                  <p className="text-xs text-muted-foreground">{context.join(" · ")}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {actorName(log.actor_id)} · {formatDateTime(log.created_at)}
                </p>
              </div>
              <Badge variant="outline">
                {CATEGORY_LABEL[CATEGORY_OF_ACTION(log.action)] ?? log.entity_type}
              </Badge>
            </div>
          );
        })}
        {pageRows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucune action ne correspond.</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Précédent
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {safePage} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= pageCount}
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
        >
          Suivant
        </Button>
      </div>
    </AppShell>
  );
}

export default AuditPage;
