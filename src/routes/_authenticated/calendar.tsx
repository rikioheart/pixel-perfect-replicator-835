import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarRange, MapPinned, Sparkle, PartyPopper, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendrier partagé — La Voix du Chien" },
      {
        name: "description",
        content:
          "Activités, événements, formations et réservations de terrain réunis dans un seul calendrier.",
      },
      { property: "og:title", content: "Calendrier partagé — La Voix du Chien" },
      {
        property: "og:description",
        content: "Toute la vie de l'association, jour après jour, au même endroit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

type Kind = "TERRAIN" | "ACTIVITY" | "EVENT" | "FORMATION";

const KINDS: Record<Kind, { label: string; icon: typeof CalendarRange }> = {
  ACTIVITY: { label: "Activités", icon: Sparkle },
  EVENT: { label: "Événements", icon: PartyPopper },
  FORMATION: { label: "Formations", icon: GraduationCap },
  TERRAIN: { label: "Terrains", icon: MapPinned },
};

type Item = { id: string; kind: Kind; title: string; date: string | null; detail: string };

function CalendarPage() {
  const [active, setActive] = useState<Record<Kind, boolean>>({
    ACTIVITY: true,
    EVENT: true,
    FORMATION: true,
    TERRAIN: true,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["shared-calendar"],
    queryFn: async (): Promise<Item[]> => {
      const [activities, events, formations, reservations] = await Promise.all([
        supabase.from("activities").select("id, title, date, location"),
        supabase.from("events").select("id, title, start_date, location"),
        supabase.from("formations").select("id, title, date, start_time, location"),
        supabase.from("terrain_reservations").select("id, date, start_time, end_time, purpose"),
      ]);
      return [
        ...(activities.data ?? []).map((a) => ({
          id: `a-${a.id}`,
          kind: "ACTIVITY" as const,
          title: a.title,
          date: a.date ? a.date.slice(0, 10) : null,
          detail: a.location ?? "",
        })),
        ...(events.data ?? []).map((e) => ({
          id: `e-${e.id}`,
          kind: "EVENT" as const,
          title: e.title,
          date: e.start_date ? e.start_date.slice(0, 10) : null,
          detail: e.location ?? "",
        })),
        ...(formations.data ?? []).map((f) => ({
          id: `f-${f.id}`,
          kind: "FORMATION" as const,
          title: f.title,
          date: f.date ? f.date.slice(0, 10) : null,
          detail: [f.start_time, f.location].filter(Boolean).join(" · "),
        })),
        ...(reservations.data ?? []).map((r) => ({
          id: `t-${r.id}`,
          kind: "TERRAIN" as const,
          title: r.purpose || "Réservation de terrain",
          date: r.date ? r.date.slice(0, 10) : null,
          detail: `${r.start_time} – ${r.end_time}`,
        })),
      ];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    items
      .filter((item) => active[item.kind] && item.date)
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))
      .forEach((item) => {
        const list = map.get(item.date!) ?? [];
        list.push(item);
        map.set(item.date!, list);
      });
    return [...map.entries()];
  }, [items, active]);

  return (
    <AppShell
      title="Calendrier partagé"
      subtitle="Activités, événements, formations et réservations de terrain, réunis au même endroit."
      actions={
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KINDS) as Kind[]).map((kind) => {
            const Icon = KINDS[kind].icon;
            return (
              <Button
                key={kind}
                size="sm"
                variant={active[kind] ? "default" : "outline"}
                onClick={() => setActive((prev) => ({ ...prev, [kind]: !prev[kind] }))}
              >
                <Icon className="mr-1.5 size-3.5" />
                {KINDS[kind].label}
              </Button>
            );
          })}
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement du calendrier…</p>
      ) : grouped.length === 0 ? (
        <EmptyState
          title="Rien de prévu pour l'instant"
          message="Dès qu'une activité, un événement ou une formation est planifié, il apparaît ici."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayItems]) => (
            <section key={date}>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {new Date(date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <div className="mt-3 space-y-2">
                {dayItems.map((item) => {
                  const Icon = KINDS[item.kind].icon;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <Icon className="size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {KINDS[item.kind].label}
                          {item.detail ? ` · ${item.detail}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
