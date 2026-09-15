import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Plus, Users, Link2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/formations")({
  head: () => ({
    meta: [
      { title: "Formations & lives — La Voix du Chien" },
      {
        name: "description",
        content:
          "Formations, webinaires, interviews et ateliers en ligne proposés aux adhérents de l'association.",
      },
      { property: "og:title", content: "Formations & lives — La Voix du Chien" },
      {
        property: "og:description",
        content: "Se former ensemble : sessions à venir et inscriptions en un clic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormationsPage,
});

const FORMATS: [string, string][] = [
  ["FORMATION", "Formation"],
  ["LIVE", "Live"],
  ["INTERVIEW", "Interview"],
  ["WEBINAIRE", "Webinaire"],
  ["ATELIER_EN_LIGNE", "Atelier en ligne"],
];
const FORMAT_LABEL = Object.fromEntries(FORMATS);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PLANNED: "Programmée",
  LIVE: "En direct",
  DONE: "Terminée",
  CANCELLED: "Annulée",
};

const EMPTY = {
  title: "",
  description: "",
  format: "FORMATION",
  speaker_name: "",
  date: "",
  start_time: "18:30",
  duration_minutes: "60",
  location: "Visioconférence",
  live_link: "",
  capacity: "30",
};

function FormationsPage() {
  const { user, isBureau, profile } = useAuth();
  const isPro = (profile?.membership_type ?? "").toUpperCase().includes("PRO");
  const canCreate = isBureau || isPro;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["formations"],
    queryFn: async () => {
      const [formations, registrations] = await Promise.all([
        supabase.from("formations").select("*").order("date", { ascending: true }),
        supabase.from("formation_registrations").select("formation_id, user_id"),
      ]);
      return { formations: formations.data ?? [], registrations: registrations.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Donnez un titre à la session.");
      const { error } = await supabase.from("formations").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        format: form.format,
        speaker_name: form.speaker_name.trim() || null,
        date: form.date || null,
        start_time: form.start_time || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        location: form.location.trim() || null,
        live_link: form.live_link.trim() || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Session créée.");
      setOpen(false);
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["formations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, registered }: { id: string; registered: boolean }) => {
      const { error } = registered
        ? await supabase
            .from("formation_registrations")
            .delete()
            .eq("formation_id", id)
            .eq("user_id", user!.id)
        : await supabase
            .from("formation_registrations")
            .insert({ formation_id: id, user_id: user!.id });
      if (error) throw new Error(error.message);
      return !registered;
    },
    onSuccess: (registered) => {
      toast.success(registered ? "Inscription confirmée." : "Inscription annulée.");
      queryClient.invalidateQueries({ queryKey: ["formations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const formations = data?.formations ?? [];
  const registrations = data?.registrations ?? [];

  return (
    <AppShell
      title="Formations & lives"
      subtitle="Se former ensemble : webinaires, interviews et ateliers proposés au réseau."
      actions={
        canCreate ? (
          <Button className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Nouvelle session
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des sessions…</p>
      ) : formations.length === 0 ? (
        <EmptyState
          title="Aucune session programmée"
          message="Les prochaines formations et lives apparaîtront ici dès leur annonce."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {formations.map((item) => {
            const people = registrations.filter((r) => r.formation_id === item.id);
            const registered = people.some((r) => r.user_id === user?.id);
            const full = item.capacity != null && people.length >= item.capacity && !registered;
            return (
              <article key={item.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                    <GraduationCap className="size-3.5" /> {FORMAT_LABEL[item.format] ?? item.format}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-base font-bold">{item.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {item.date ? new Date(item.date).toLocaleDateString("fr-FR") : "Date à venir"}
                  {item.start_time ? ` · ${item.start_time}` : ""}
                  {item.duration_minutes ? ` · ${item.duration_minutes} min` : ""}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
                {item.speaker_name ? (
                  <p className="mt-1 text-xs text-muted-foreground">Avec {item.speaker_name}</p>
                ) : null}
                {item.description ? (
                  <p className="mt-3 text-sm whitespace-pre-wrap">{item.description}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    variant={registered ? "outline" : "default"}
                    className="rounded-full"
                    disabled={full || toggle.isPending}
                    onClick={() => toggle.mutate({ id: item.id, registered })}
                  >
                    {registered ? "Annuler mon inscription" : full ? "Complet" : "Je m'inscris"}
                  </Button>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" /> {people.length}
                    {item.capacity != null ? ` / ${item.capacity}` : ""} inscrit(s)
                  </span>
                  {registered && item.live_link ? (
                    <a
                      href={item.live_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                    >
                      <Link2 className="size-3.5" /> Rejoindre
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="f-title">Titre</Label>
              <Input
                id="f-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Format</Label>
              <Select value={form.format} onValueChange={(format) => setForm({ ...form, format })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-speaker">Intervenant</Label>
              <Input
                id="f-speaker"
                value={form.speaker_name}
                onChange={(e) => setForm({ ...form, speaker_name: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="f-date">Date</Label>
                <Input
                  id="f-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-time">Heure</Label>
                <Input
                  id="f-time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-duration">Durée (min)</Label>
                <Input
                  id="f-duration"
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-capacity">Places</Label>
                <Input
                  id="f-capacity"
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-location">Lieu</Label>
              <Input
                id="f-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-link">Lien de connexion</Label>
              <Input
                id="f-link"
                placeholder="https://…"
                value={form.live_link}
                onChange={(e) => setForm({ ...form, live_link: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-description">Description</Label>
              <Textarea
                id="f-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-full" disabled={create.isPending} onClick={() => create.mutate()}>
              Créer la session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
