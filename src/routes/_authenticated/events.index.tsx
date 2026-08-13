import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarRange, MapPin, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({
    meta: [
      { title: "Événements — La Voix du Chien" },
      {
        name: "description",
        content:
          "Calendrier des événements de l'association : rencontres, portes ouvertes et actions avec les partenaires.",
      },
      { property: "og:title", content: "Événements — La Voix du Chien" },
      {
        property: "og:description",
        content: "Retrouvez le calendrier des événements organisés par l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventsPage,
});

const EVENT_TYPES = ["RENCONTRE", "PORTES_OUVERTES", "SALON", "COLLECTE"] as const;

export function formatEventDate(value: string | null) {
  if (!value) return "à définir";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

function EventsPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_type: "RENCONTRE",
    start_date: "",
    end_date: "",
    location: "",
    visibility: "ASSOCIATION",
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 3) throw new Error("Le titre doit faire au moins 3 caractères.");
      if (form.start_date && form.end_date && form.end_date < form.start_date)
        throw new Error("La date de fin doit être postérieure à la date de début.");
      const { error } = await supabase.from("events").insert({
        title: form.title.trim(),
        description: form.description || null,
        event_type: form.event_type,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        location: form.location || null,
        visibility: form.visibility,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Événement créé.");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Événements"
      subtitle="Calendrier des temps forts de l'association"
      actions={
        isBureau ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" /> Nouvel événement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvel événement</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ev-title">Titre</Label>
                  <Input
                    id="ev-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ev-desc">Description</Label>
                  <Textarea
                    id="ev-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ev-type">Type</Label>
                    <select
                      id="ev-type"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.event_type}
                      onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                    >
                      {EVENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="ev-vis">Visibilité</Label>
                    <select
                      id="ev-vis"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.visibility}
                      onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                    >
                      <option value="ASSOCIATION">Tous les membres</option>
                      <option value="BUREAU">Bureau uniquement</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ev-start">Début</Label>
                    <Input
                      id="ev-start"
                      type="datetime-local"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ev-end">Fin</Label>
                    <Input
                      id="ev-end"
                      type="datetime-local"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ev-loc">Lieu</Label>
                  <Input
                    id="ev-loc"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending ? "Création…" : "Créer l'événement"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement du calendrier…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun événement programmé.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{event.title}</CardTitle>
                  <Badge variant="secondary">{event.event_type.replace("_", " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <CalendarRange className="size-4" /> {formatEventDate(event.start_date)}
                </p>
                {event.location ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4" /> {event.location}
                  </p>
                ) : null}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/events/$eventId" params={{ eventId: event.id }}>
                    Voir la fiche
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
