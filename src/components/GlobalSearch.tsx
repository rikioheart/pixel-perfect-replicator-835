import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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

type Filter =
  | "ALL"
  | "person"
  | "professional"
  | "dog"
  | "document"
  | "project"
  | "task"
  | "activity"
  | "event"
  | "resource"
  | "participation";

type Hit = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  link: string;
  occurred_at: string | null;
};

const FILTERS: { code: Filter; label: string }[] = [
  { code: "ALL", label: "Tout" },
  { code: "person", label: "Personnes" },
  { code: "professional", label: "Professionnels" },
  { code: "dog", label: "Chiens" },
  { code: "document", label: "Documents" },
  { code: "project", label: "Projets" },
  { code: "task", label: "Tâches" },
  { code: "activity", label: "Activités" },
  { code: "event", label: "Événements" },
  { code: "resource", label: "Ressources" },
  { code: "participation", label: "Participations" },
];

const KIND_LABEL: Record<string, string> = {
  person: "Personne",
  professional: "Professionnel",
  dog: "Chien",
  document: "Document",
  project: "Projet",
  task: "Tâche",
  activity: "Activité",
  event: "Événement",
  resource: "Ressource",
  participation: "Participation",
};

/** Recherche globale accessible depuis toutes les pages (Ctrl/⌘ + K). */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTerm(term.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  const search = debouncedTerm;

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["global-search", search, filter, since],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const params: { _term: string; _kind?: string; _since?: string } = {
        _term: search,
      };
      if (filter !== "ALL") params._kind = filter;
      if (since) params._since = since;
      const { data, error } = await supabase.rpc("global_search", params);
      if (error) throw error;
      return (data ?? []) as Hit[];
    },
  });

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
              Uniquement les personnes, chiens et objets que vous êtes autorisé à ouvrir.
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
              ) : hits.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun résultat.</p>
              ) : (
                hits.map((hit) => (
                  <Button
                    key={hit.id}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setOpen(false);
                      void navigate({ to: hit.link as never });
                    }}
                    className="h-auto min-h-14 w-full justify-start rounded-md border border-border p-3 text-left text-sm"
                  >
                    <span>
                      <span className="block font-medium">{hit.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {KIND_LABEL[hit.kind] ?? hit.kind}
                        {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                        {hit.occurred_at ? ` · ${new Date(hit.occurred_at).toLocaleDateString("fr-FR")}` : ""}
                      </span>
                    </span>
                  </Button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
