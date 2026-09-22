import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Filter = "ALL" | "person" | "pro" | "document" | "request" | "project" | "task" | "event";

type Hit = {
  id: string;
  kind: Exclude<Filter, "ALL">;
  title: string;
  subtitle: string;
  to: string;
  date: string | null;
};

const FILTERS: { code: Filter; label: string }[] = [
  { code: "ALL", label: "Tout" },
  { code: "person", label: "Personnes" },
  { code: "pro", label: "Professionnels" },
  { code: "document", label: "Documents" },
  { code: "request", label: "Demandes" },
  { code: "project", label: "Projets" },
  { code: "task", label: "Tâches" },
  { code: "event", label: "Événements" },
];

const KIND_LABEL: Record<Exclude<Filter, "ALL">, string> = {
  person: "Personne",
  pro: "Professionnel",
  document: "Document",
  request: "Demande d'aide",
  project: "Projet",
  task: "Tâche",
  event: "Événement",
};

/** Recherche globale accessible depuis toutes les pages (Ctrl/⌘ + K). */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [since, setSince] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = term.trim();

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["global-search", search, filter, since],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const like = `%${search}%`;
      const want = (kind: Filter) => filter === "ALL" || filter === kind;
      const results: Hit[] = [];

      if (want("person") || want("pro")) {
        const { data } = await supabase
          .from("profiles")
          .select("id, display_name, first_name, last_name, city, membership_type, created_at")
          .or(
            `display_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},city.ilike.${like}`,
          )
          .limit(20);
        for (const row of data ?? []) {
          const isPro = (row.membership_type ?? "").toUpperCase().includes("PRO");
          if (!want(isPro ? "pro" : "person")) continue;
          results.push({
            id: `profile-${row.id}`,
            kind: isPro ? "pro" : "person",
            title:
              row.display_name ||
              `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() ||
              "Adhérent",
            subtitle: row.city ?? row.membership_type ?? "",
            to: isPro ? `/professionals/${row.id}` : `/members/${row.id}`,
            date: row.created_at,
          });
        }
      }

      if (want("document")) {
        const { data } = await supabase
          .from("documents")
          .select("id, title, category, created_at")
          .ilike("title", like)
          .limit(15);
        for (const row of data ?? []) {
          results.push({
            id: `doc-${row.id}`,
            kind: "document",
            title: row.title,
            subtitle: row.category ?? "Document",
            to: "/documents",
            date: row.created_at,
          });
        }
      }

      if (want("request")) {
        const { data } = await supabase
          .from("help_requests")
          .select("id, message, type, status, created_at")
          .ilike("message", like)
          .limit(15);
        for (const row of data ?? []) {
          results.push({
            id: `req-${row.id}`,
            kind: "request",
            title: row.message.slice(0, 70),
            subtitle: `${row.type} · ${row.status}`,
            to: "/help-requests",
            date: row.created_at,
          });
        }
      }

      if (want("project")) {
        const { data } = await supabase
          .from("projects")
          .select("id, title, status, created_at")
          .ilike("title", like)
          .limit(15);
        for (const row of data ?? []) {
          results.push({
            id: `proj-${row.id}`,
            kind: "project",
            title: row.title,
            subtitle: row.status,
            to: `/projects/${row.id}`,
            date: row.created_at,
          });
        }
      }

      if (want("task")) {
        const { data } = await supabase
          .from("tasks")
          .select("id, title, status, created_at")
          .ilike("title", like)
          .limit(15);
        for (const row of data ?? []) {
          results.push({
            id: `task-${row.id}`,
            kind: "task",
            title: row.title,
            subtitle: row.status,
            to: "/tasks",
            date: row.created_at,
          });
        }
      }

      if (want("event")) {
        const { data } = await supabase
          .from("events")
          .select("id, title, location, start_date, created_at")
          .ilike("title", like)
          .limit(15);
        for (const row of data ?? []) {
          results.push({
            id: `event-${row.id}`,
            kind: "event",
            title: row.title,
            subtitle: row.location ?? "Événement",
            to: `/events/${row.id}`,
            date: row.start_date ?? row.created_at,
          });
        }
      }

      return results;
    },
  });

  const filtered = useMemo(() => {
    if (!since) return hits;
    const from = new Date(since).getTime();
    return hits.filter((hit) => (hit.date ? new Date(hit.date).getTime() >= from : false));
  }, [hits, since]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        aria-label="Recherche globale"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Rechercher</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rechercher</DialogTitle>
            <DialogDescription>
              Personnes, professionnels, documents, demandes, projets, tâches et événements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Tapez au moins deux lettres…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <Button
                  key={item.code}
                  size="sm"
                  variant={filter === item.code ? "default" : "outline"}
                  onClick={() => setFilter(item.code)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="search-since" className="text-xs text-muted-foreground">
                À partir du
              </label>
              <Input
                id="search-since"
                type="date"
                className="w-44"
                value={since}
                onChange={(e) => setSince(e.target.value)}
              />
              {since ? (
                <Button variant="ghost" size="sm" onClick={() => setSince("")}>
                  Effacer
                </Button>
              ) : null}
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto">
              {search.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Commencez à écrire pour lancer la recherche.
                </p>
              ) : isFetching ? (
                <p className="text-sm text-muted-foreground">Recherche…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun résultat.</p>
              ) : (
                filtered.map((hit) => (
                  <Link
                    key={hit.id}
                    to={hit.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-md border border-border p-3 text-sm hover:bg-muted"
                  >
                    <p className="font-medium">{hit.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABEL[hit.kind]}
                      {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                      {hit.date
                        ? ` · ${new Date(hit.date).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
