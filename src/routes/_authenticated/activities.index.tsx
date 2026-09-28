import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DOG_POLICY_LABEL } from "@/lib/pro-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, MapPin, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";

export const Route = createFileRoute("/_authenticated/activities/")({
  head: () => ({
    meta: [
      { title: "Activités — La Voix du Chien" },
      {
        name: "description",
        content:
          "Catalogue des activités de l'association : ateliers, balades éducatives, tarifs adhérents et inscriptions.",
      },
      { property: "og:title", content: "Activités — La Voix du Chien" },
      {
        property: "og:description",
        content: "Ateliers, balades et rencontres proposés aux adhérents de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivitiesPage,
});

const ACTIVITY_TYPES = ["ATELIER", "BALADE", "FORMATION", "RENCONTRE"] as const;

function formatDate(value: string | null) {
  if (!value) return "Date à définir";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function ActivitiesPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "ATELIER",
    date: "",
    location: "",
    price_public: "0",
    price_member: "0",
    image_url: "",
    eligible_for_loyalty: true,
    capacity: "",
    dog_policy: "OPTIONAL",
    max_dogs: "",
    for_you_if: "",
    to_bring: "",
    before_coming: "",
    with_your_dog: "",
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: myParticipations = [] } = useQuery({
    queryKey: ["participations", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participations")
        .select("id,activity_id,registration_status")
        .eq("user_id", user!.id)
        .not("activity_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const register = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase.from("participations").insert({
        user_id: user!.id,
        activity_id: activityId,
        role: "PARTICIPANT",
        registration_status: "PENDING",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscription enregistrée, en attente de confirmation.");
      void queryClient.invalidateQueries({ queryKey: ["participations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unregister = useMutation({
    mutationFn: async (participationId: string) => {
      const { error } = await supabase.from("participations").delete().eq("id", participationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscription annulée.");
      void queryClient.invalidateQueries({ queryKey: ["participations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 3) throw new Error("Le titre doit faire au moins 3 caractères.");
      const { error } = await supabase.from("activities").insert({
        title: form.title.trim(),
        description: form.description || null,
        type: form.type,
        date: form.date ? new Date(form.date).toISOString() : null,
        location: form.location || null,
        price_public: Number(form.price_public) || 0,
        price_member: Number(form.price_member) || 0,
        image_url: form.image_url.trim() || null,
        eligible_for_loyalty: form.eligible_for_loyalty,
        capacity: form.capacity ? Number(form.capacity) : null,
        dog_policy: form.dog_policy,
        max_dogs: form.max_dogs ? Number(form.max_dogs) : null,
        for_you_if: form.for_you_if.trim() || null,
        to_bring: form.to_bring.trim() || null,
        before_coming: form.before_coming.trim() || null,
        with_your_dog: form.with_your_dog.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activité créée.");
      setOpen(false);
      setForm({
        title: "",
        description: "",
        type: "ATELIER",
        date: "",
        location: "",
        price_public: "0",
        price_member: "0",
        image_url: "",
        eligible_for_loyalty: true,
        capacity: "",
        dog_policy: "OPTIONAL",
        max_dogs: "",
        for_you_if: "",
        to_bring: "",
        before_coming: "",
        with_your_dog: "",
      });
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Activités"
      subtitle="Ateliers, balades et rencontres proposés aux adhérents"
      actions={
        isBureau ? (
          <>
              <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Nouvelle activité
              </Button>
            <SidePanel
              open={open}
              onOpenChange={setOpen}
              title="Nouvelle activité"
              description="Créez une activité : elle apparaît immédiatement dans l'agenda des adhérents."
            >
              <div className="space-y-3">
                <div>
                  <Label htmlFor="act-title">Titre</Label>
                  <Input
                    id="act-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="act-desc">Description</Label>
                  <Textarea
                    id="act-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="act-type">Type</Label>
                    <select
                      id="act-type"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      {ACTIVITY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="act-date">Date</Label>
                    <Input
                      id="act-date"
                      type="datetime-local"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="act-loc">Lieu</Label>
                  <Input
                    id="act-loc"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="act-img">Image (URL)</Label>
                  <Input
                    id="act-img"
                    placeholder="https://…"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="act-pm">Tarif adhérent (€)</Label>
                    <Input
                      id="act-pm"
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.price_member}
                      onChange={(e) => setForm({ ...form, price_member: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="act-pp">Tarif public (€)</Label>
                    <Input
                      id="act-pp"
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.price_public}
                      onChange={(e) => setForm({ ...form, price_public: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="act-cap">Capacité</Label>
                    <Input id="act-cap" type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="act-dp">Chiens</Label>
                    <select id="act-dp" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.dog_policy} onChange={(e) => setForm({ ...form, dog_policy: e.target.value })}>
                      {Object.entries(DOG_POLICY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="act-md">Chiens max.</Label>
                    <Input id="act-md" type="number" min="1" value={form.max_dogs} onChange={(e) => setForm({ ...form, max_dogs: e.target.value })} />
                  </div>
                </div>
                {([["for_you_if", "Faite pour vous si…"], ["to_bring", "À prévoir"], ["before_coming", "Avant de venir"], ["with_your_dog", "Avec votre chien"]] as const).map(([k, l]) => (
                  <div key={k}>
                    <Label htmlFor={`act-${k}`}>{l}</Label>
                    <Textarea id={`act-${k}`} rows={2} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.eligible_for_loyalty}
                    onChange={(e) => setForm({ ...form, eligible_for_loyalty: e.target.checked })}
                  />
                  Éligible à la carte de fidélité
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => create.mutate()}
                  disabled={create.isPending}
                >
                  {create.isPending ? "Création…" : "Créer l'activité"}
                </Button>
              </div>
            </SidePanel>
          </>
        ) : null
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des activités…</p>
      ) : activities.length === 0 ? (
        <EmptyState
          title="Aucune activité pour l'instant"
          message="Les prochains ateliers et sorties s'afficheront ici dès que le Bureau les aura programmés."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => {
            const participation = myParticipations.find((p) => p.activity_id === activity.id);
            return (
              <Card key={activity.id} className="overflow-hidden">
                {activity.image_url ? (
                  <img
                    src={activity.image_url}
                    alt={`Illustration de l'activité ${activity.title}`}
                    loading="lazy"
                    className="h-36 w-full object-cover"
                  />
                ) : null}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base"><Link to="/activities/$activityId" params={{ activityId: activity.id }} className="hover:underline">{activity.title}</Link></CardTitle>
                    <Badge variant="secondary">{activity.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {activity.description ? (
                    <p className="text-muted-foreground">{activity.description}</p>
                  ) : null}
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4" /> {formatDate(activity.date)}
                  </p>
                  {activity.location ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-4" /> {activity.location}
                    </p>
                  ) : null}
                  <p>
                    <span className="font-medium">{Number(activity.price_member).toFixed(2)} €</span>{" "}
                    adhérent · {Number(activity.price_public).toFixed(2)} € public
                  </p>
                  {activity.eligible_for_loyalty ? (
                    <p className="flex items-center gap-1.5 text-xs text-primary">
                      <Sparkles className="size-3.5" /> Donne droit à un tampon fidélité
                    </p>
                  ) : null}
                  {participation ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Badge>
                        {participation.registration_status === "CONFIRMED"
                          ? "Inscription confirmée"
                          : "En attente de confirmation"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unregister.mutate(participation.id)}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button asChild size="sm" className="w-full">
                      <Link to="/activities/$activityId" params={{ activityId: activity.id }}>
                        Voir et s'inscrire · {DOG_POLICY_LABEL[activity.dog_policy]}
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
