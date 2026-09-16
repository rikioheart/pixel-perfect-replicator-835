import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trophy, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/contests")({
  head: () => ({
    meta: [
      { title: "Concours & animations — La Voix du Chien" },
      {
        name: "description",
        content:
          "Concours photo, quiz et animations proposés aux adhérents : participez et découvrez les gagnants.",
      },
      { property: "og:title", content: "Concours & animations — La Voix du Chien" },
      {
        property: "og:description",
        content: "Les jeux et animations de l'association, avec leurs lots et leurs gagnants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContestsPage,
});

const TYPES: [string, string][] = [
  ["PHOTO", "Concours photo"],
  ["QUIZ", "Quiz"],
  ["TIRAGE", "Tirage au sort"],
  ["ANIMATION", "Animation"],
];
const TYPE_LABEL = Object.fromEntries(TYPES);

const STATUS: [string, string][] = [
  ["DRAFT", "Brouillon"],
  ["OPEN", "En cours"],
  ["CLOSED", "Clôturé"],
  ["ANNOUNCED", "Résultats annoncés"],
];
const STATUS_LABEL = Object.fromEntries(STATUS);

const EMPTY = {
  title: "",
  description: "",
  type: "PHOTO",
  start_date: "",
  end_date: "",
  status: "OPEN",
  prizes: "",
  winners: "",
};

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
}

function ContestsPage() {
  const { isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["contests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contests")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Donnez un titre au concours.");
      const { error } = await supabase.from("contests").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        prizes: form.prizes
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        winners: form.winners
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Concours enregistré.");
      setOpen(false);
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["contests"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const contests = data ?? [];

  return (
    <AppShell
      title="Concours & animations"
      subtitle="Les jeux, concours photo et animations qui font vivre la communauté."
      actions={
        isBureau ? (
          <Button className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Nouveau concours
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des concours…</p>
      ) : contests.length === 0 ? (
        <EmptyState
          title="Aucun concours pour le moment"
          message="Les prochaines animations et concours de l'association s'afficheront ici."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {contests.map((item) => {
            const prizes = toList(item.prizes);
            const winners = toList(item.winners);
            return (
              <article key={item.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                    <Trophy className="size-3.5" /> {TYPE_LABEL[item.type] ?? item.type}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-base font-bold">{item.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {item.start_date
                    ? `Du ${new Date(item.start_date).toLocaleDateString("fr-FR")}`
                    : "Dates à venir"}
                  {item.end_date ? ` au ${new Date(item.end_date).toLocaleDateString("fr-FR")}` : ""}
                </p>
                {item.description ? (
                  <p className="mt-3 text-sm whitespace-pre-wrap">{item.description}</p>
                ) : null}
                {prizes.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">À gagner</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {prizes.map((prize, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Sparkles className="size-3.5 text-primary" /> {prize}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {winners.length > 0 ? (
                  <div className="mt-4 rounded-lg bg-muted/60 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Bravo aux gagnants
                    </p>
                    <p className="mt-1 text-sm">{winners.join(" · ")}</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau concours</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="c-title">Titre</Label>
              <Input
                id="c-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-start">Début</Label>
                <Input
                  id="c-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-end">Fin</Label>
                <Input
                  id="c-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-description">Description</Label>
              <Textarea
                id="c-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-prizes">Lots (un par ligne)</Label>
              <Textarea
                id="c-prizes"
                rows={3}
                value={form.prizes}
                onChange={(e) => setForm({ ...form, prizes: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-winners">Gagnants (un par ligne)</Label>
              <Textarea
                id="c-winners"
                rows={2}
                value={form.winners}
                onChange={(e) => setForm({ ...form, winners: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="rounded-full"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
