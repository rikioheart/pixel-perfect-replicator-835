import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarCheck, Stamp, ListChecks, HandHeart, Settings2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences, TEXT_SIZES, DEFAULT_VIEWS } from "@/lib/user-preferences";

export const Route = createFileRoute("/_authenticated/my-space")({
  head: () => ({
    meta: [
      { title: "Mon espace personnel — La Voix du Chien" },
      {
        name: "description",
        content:
          "Récapitulatif de vos participations, de votre fidélité et de vos préférences d'affichage.",
      },
      { property: "og:title", content: "Mon espace personnel — La Voix du Chien" },
      {
        property: "og:description",
        content: "Ce que vous avez rejoint, vos demandes d'aide et vos préférences d'accessibilité.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MySpacePage,
});

const TABS: [string, string][] = [
  ["RECAP", "Mon récapitulatif"],
  ["PREFERENCES", "Affichage & accessibilité"],
  ["COMPTE", "Notifications"],
];

function MySpacePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("RECAP");
  const { preferences, save } = useUserPreferences();

  const { data } = useQuery({
    queryKey: ["my-space", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [participations, tasks, card, help] = await Promise.all([
        supabase
          .from("participations")
          .select(
            "id, registration_status, activities(title, date, location), events(title, start_date, location)",
          )
          .eq("user_id", user!.id),
        supabase.from("tasks").select("id, title, status").eq("assigned_user_id", user!.id),
        supabase.from("loyalty_cards").select("total_stamps").eq("member_id", user!.id).maybeSingle(),
        supabase
          .from("help_requests")
          .select("id, type, message, status, response, created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
      ]);

      const now = Date.now();
      const upcoming = (participations.data ?? [])
        .map((row) => {
          const a = row.activities as { title: string; date: string | null; location: string | null } | null;
          const e = row.events as { title: string; start_date: string | null; location: string | null } | null;
          return {
            id: row.id,
            title: a?.title ?? e?.title ?? "Inscription",
            date: a?.date ?? e?.start_date ?? null,
            location: a?.location ?? e?.location ?? null,
          };
        })
        .filter((item) => item.date && new Date(item.date).getTime() >= now)
        .sort((x, y) => new Date(x.date!).getTime() - new Date(y.date!).getTime());

      return {
        participations: participations.data ?? [],
        tasks: tasks.data ?? [],
        stamps: card.data?.total_stamps ?? 0,
        help: help.data ?? [],
        upcoming,
      };
    },
  });

  const kpis: [string, number, typeof CalendarCheck][] = [
    ["Inscriptions", data?.participations.length ?? 0, CalendarCheck],
    ["Tâches confiées", data?.tasks.length ?? 0, ListChecks],
    ["Tampons de fidélité", data?.stamps ?? 0, Stamp],
    ["Demandes d'aide", data?.help.length ?? 0, HandHeart],
  ];

  return (
    <AppShell
      title="Mon espace personnel"
      subtitle="Ce que vous avez rejoint, vos préférences d'affichage et vos demandes."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "RECAP" && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map(([label, value, Icon]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <Icon className="size-4 text-primary" />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-primary">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Mes prochains rendez-vous</h2>
            <div className="mt-4">
              {(data?.upcoming.length ?? 0) === 0 ? (
                <EmptyState
                  title="Aucun rendez-vous à venir"
                  message="Inscrivez-vous à une balade ou un atelier pour les retrouver ici."
                  action={
                    <Link to="/activities">
                      <Button size="sm" className="rounded-full">
                        Voir les activités
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {data!.upcoming.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
                    >
                      <span className="font-semibold">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.date!).toLocaleDateString("fr-FR")}
                        {item.location ? ` · ${item.location}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Mes demandes d'aide</h2>
            <div className="mt-4">
              {(data?.help.length ?? 0) === 0 ? (
                <EmptyState
                  title="Aucune demande envoyée"
                  message="Signaler un blocage n'est jamais un échec : c'est ce qui permet d'avancer ensemble."
                  action={
                    <Link to="/help-requests">
                      <Button size="sm" variant="outline" className="rounded-full">
                        J'ai besoin d'aide
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {data!.help.map((item) => (
                    <li key={item.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {item.type === "NEEDS_HELP" ? "Besoin d'aide" : "Propose son aide"}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                          {item.status === "RESOLVED"
                            ? "Résolue"
                            : item.status === "HANDLED"
                              ? "Prise en charge"
                              : "Ouverte"}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{item.message}</p>
                      {item.response ? (
                        <p className="mt-2 rounded-lg bg-muted/60 p-3 text-xs">
                          Réponse du Bureau : {item.response}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "PREFERENCES" && (
        <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label>Taille du texte</Label>
            <Select
              value={preferences.text_size}
              onValueChange={(value) => save.mutate({ text_size: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_SIZES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Affichage par défaut des listes</Label>
            <Select
              value={preferences.default_view}
              onValueChange={(value) => save.mutate({ default_view: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_VIEWS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="contrast">Contraste renforcé</Label>
            <Switch
              id="contrast"
              checked={preferences.high_contrast}
              onCheckedChange={(checked) => save.mutate({ high_contrast: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="motion">Réduire les animations</Label>
            <Switch
              id="motion"
              checked={preferences.reduced_motion}
              onCheckedChange={(checked) => save.mutate({ reduced_motion: checked })}
            />
          </div>

          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Settings2 className="size-3.5" /> Vos informations personnelles se modifient dans{" "}
            <Link to="/profile" className="font-semibold text-primary hover:underline">
              Mon profil
            </Link>
            .
          </p>
        </div>
      )}

      {tab === "COMPTE" && (
        <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="in-app">Notifications dans l'application</Label>
            <Switch
              id="in-app"
              checked={preferences.notify_in_app}
              onCheckedChange={(checked) => save.mutate({ notify_in_app: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="email">Notifications par e-mail</Label>
            <Switch
              id="email"
              checked={preferences.notify_email}
              onCheckedChange={(checked) => save.mutate({ notify_email: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="reminders">Rappels avant mes rendez-vous</Label>
            <Switch
              id="reminders"
              checked={preferences.notify_reminders}
              onCheckedChange={(checked) => save.mutate({ notify_reminders: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="updates">Afficher « Ce que nous construisons ensemble » sur mon accueil</Label>
            <Switch
              id="updates"
              checked={preferences.show_association_updates}
              onCheckedChange={(checked) => save.mutate({ show_association_updates: checked })}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
