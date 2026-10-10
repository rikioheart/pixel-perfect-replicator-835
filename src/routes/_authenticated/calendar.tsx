import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarRange, MapPinned, Sparkle, PartyPopper, GraduationCap, ListChecks, FolderKanban,
  ChevronLeft, ChevronRight, AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EntityPeek, type PeekType } from "@/components/EntityPeek";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendrier associatif — La Voix du Chien" },
      { name: "description", content: "Activités, événements, formations, terrain, projets et échéances dans un seul calendrier." },
      { property: "og:title", content: "Calendrier associatif — La Voix du Chien" },
      { property: "og:description", content: "Toute la vie de l'association, jour après jour, au même endroit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

type Kind = "ACTIVITY" | "EVENT" | "FORMATION" | "TERRAIN" | "TASK" | "PROJECT";
type View = "list" | "week" | "month";

const KINDS: Record<Kind, { label: string; icon: typeof CalendarRange; peek?: PeekType }> = {
  ACTIVITY: { label: "Activités", icon: Sparkle, peek: "activity" },
  EVENT: { label: "Événements", icon: PartyPopper, peek: "event" },
  FORMATION: { label: "Formations", icon: GraduationCap },
  TERRAIN: { label: "Terrain", icon: MapPinned, peek: "reservation" },
  TASK: { label: "Échéances", icon: ListChecks, peek: "task" },
  PROJECT: { label: "Projets", icon: FolderKanban, peek: "project" },
};

const STATUS_FR: Record<string, string> = {
  DRAFT: "brouillon", PENDING: "en attente", CHANGES_REQUESTED: "à modifier", APPROVED: "validée",
  REFUSED: "refusée", CANCELLED: "annulée",
};

type Item = { id: string; rawId: string; kind: Kind; title: string; date: string; detail: string; conflict?: boolean };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Les éléments viennent de leurs tables métier (RLS appliquée) : aucune copie « calendrier ». */
function CalendarPage() {
  const [active, setActive] = useState<Record<Kind, boolean>>({
    ACTIVITY: true, EVENT: true, FORMATION: true, TERRAIN: true, TASK: true, PROJECT: true,
  });
  const [view, setView] = useState<View>("list");
  const [cursor, setCursor] = useState(() => new Date());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["shared-calendar"],
    queryFn: async (): Promise<Item[]> => {
      const [a, e, f, r, t, p] = await Promise.all([
        supabase.from("activities").select("id, title, date, location, category"),
        supabase.from("events").select("id, title, start_date, location, visibility"),
        supabase.from("formations").select("id, title, date, start_time, location"),
        supabase.from("terrain_reservations").select("id, resource_id, date, start_time, end_time, purpose, status, work_category, equipment_requested"),
        supabase.from("tasks").select("id, title, deadline, status").not("deadline", "is", null).neq("status", "DONE"),
        supabase.from("projects").select("id, title, deadline").not("deadline", "is", null).is("archived_at", null),
      ]);
      const res = r.data ?? [];
      const live = res.filter((x) => x.status === "PENDING" || x.status === "APPROVED");
      const conflict = (x: (typeof res)[number]) =>
        live.some((y) => y.id !== x.id && y.resource_id === x.resource_id && y.date === x.date &&
          y.start_time < x.end_time && x.start_time < y.end_time);
      const out: Item[] = [
        ...(a.data ?? []).filter((x) => x.date).map((x) => ({ id: `a-${x.id}`, rawId: x.id, kind: "ACTIVITY" as const, title: x.title,
          date: x.date!.slice(0, 10), detail: [x.category, x.location].filter(Boolean).join(" · ") })),
        ...(e.data ?? []).filter((x) => x.start_date).map((x) => ({ id: `e-${x.id}`, rawId: x.id, kind: "EVENT" as const, title: x.title,
          date: x.start_date!.slice(0, 10), detail: x.location ?? "" })),
        ...(f.data ?? []).filter((x) => x.date).map((x) => ({ id: `f-${x.id}`, rawId: x.id, kind: "FORMATION" as const, title: x.title,
          date: x.date!.slice(0, 10), detail: [x.start_time, x.location].filter(Boolean).join(" · ") })),
        ...res.filter((x) => x.status !== "CANCELLED").map((x) => ({ id: `t-${x.id}`, rawId: x.id, kind: "TERRAIN" as const,
          title: x.purpose || x.work_category || "Réservation de terrain", date: x.date,
          detail: [`${x.start_time.slice(0, 5)}–${x.end_time.slice(0, 5)}`, STATUS_FR[x.status] ?? x.status,
            x.equipment_requested ? `matériel : ${x.equipment_requested}` : null].filter(Boolean).join(" · "),
          conflict: (x.status === "PENDING" || x.status === "APPROVED") && conflict(x) })),
        ...(t.data ?? []).map((x) => ({ id: `k-${x.id}`, rawId: x.id, kind: "TASK" as const, title: x.title, date: x.deadline!, detail: "échéance de tâche" })),
        ...(p.data ?? []).map((x) => ({ id: `p-${x.id}`, rawId: x.id, kind: "PROJECT" as const, title: x.title, date: x.deadline!, detail: "échéance de projet" })),
      ];
      return out.sort((x, y) => (x.date < y.date ? -1 : 1));
    },
  });

  const visible = useMemo(() => items.filter((i) => active[i.kind]), [items, active]);
  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    visible.forEach((i) => m.set(i.date, [...(m.get(i.date) ?? []), i]));
    return m;
  }, [visible]);

  const days = useMemo(() => {
    if (view === "week") {
      const s = new Date(cursor); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const s = new Date(first); s.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
  }, [view, cursor]);

  const move = (dir: number) => {
    const d = new Date(cursor);
    if (view === "week") d.setDate(d.getDate() + 7 * dir); else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };
  const today = iso(new Date());
  const upcoming = [...byDay.entries()].filter(([d]) => d >= today);

  const Chip = ({ item, compact }: { item: Item; compact?: boolean }) => {
    const K = KINDS[item.kind];
    const Icon = K.icon;
    const body = (
      <button type="button" className={`flex w-full min-w-0 items-center gap-2 rounded-lg border bg-card text-left ${compact ? "px-1.5 py-1" : "px-4 py-3"} ${item.conflict ? "border-destructive" : "border-border"} hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring`}>
        <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${compact ? "text-[11px]" : "text-sm"}`}>{item.title}</span>
          {!compact && <span className="block truncate text-xs text-muted-foreground">{K.label}{item.detail ? ` · ${item.detail}` : ""}</span>}
        </span>
        {item.conflict && <AlertTriangle className="ml-auto size-3.5 shrink-0 text-destructive" aria-label="Chevauchement de créneau" />}
      </button>
    );
    return K.peek ? <EntityPeek type={K.peek} id={item.rawId}>{body}</EntityPeek> : body;
  };

  return (
    <AppShell title="Calendrier associatif" subtitle="Chaque élément vient de sa source : rien n'est recopié, et vous ne voyez que ce qui vous est autorisé.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vue" className="flex gap-1">
          {(["list", "week", "month"] as View[]).map((v) => (
            <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)} aria-pressed={view === v}>
              {v === "list" ? "Agenda" : v === "week" ? "Semaine" : "Mois"}
            </Button>
          ))}
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => move(-1)} aria-label="Période précédente"><ChevronLeft className="size-4" /></Button>
            <span className="min-w-36 text-center text-sm font-semibold capitalize">
              {view === "month" ? cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
                : `Semaine du ${days[0]!.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
            </span>
            <Button size="icon" variant="ghost" onClick={() => move(1)} aria-label="Période suivante"><ChevronRight className="size-4" /></Button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtres">
          {(Object.keys(KINDS) as Kind[]).map((k) => {
            const Icon = KINDS[k].icon;
            return (
              <Button key={k} size="sm" variant={active[k] ? "secondary" : "outline"} aria-pressed={active[k]}
                onClick={() => setActive((p) => ({ ...p, [k]: !p[k] }))}>
                <Icon className="mr-1 size-3.5" />{KINDS[k].label}
              </Button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">Chargement du calendrier…</p>
      ) : view === "list" ? (
        upcoming.length === 0 ? (
          <EmptyState title="Rien de prévu pour l'instant" message="Dès qu'une activité, une réservation ou une échéance est planifiée, elle apparaît ici." />
        ) : (
          <div className="space-y-6">
            {upcoming.map(([date, list]) => (
              <section key={date}>
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </h2>
                <div className="mt-3 space-y-2">{list.map((i) => <Chip key={i.id} item={i} />)}</div>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className={`grid gap-1 ${view === "month" ? "grid-cols-7" : "grid-cols-1 sm:grid-cols-7"}`}>
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} className={`text-center text-xs font-semibold text-muted-foreground ${view === "week" ? "hidden sm:block" : ""}`}>{d}</div>
          ))}
          {days.map((d) => {
            const k = iso(d);
            const list = byDay.get(k) ?? [];
            const out = view === "month" && d.getMonth() !== cursor.getMonth();
            return (
              <div key={k} className={`min-h-20 rounded-lg border border-border p-1 ${out ? "opacity-40" : ""} ${k === today ? "ring-2 ring-primary" : ""}`}>
                <p className="mb-1 text-[11px] font-semibold">{view === "week" ? d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) : d.getDate()}</p>
                <div className="space-y-1">
                  {list.slice(0, view === "month" ? 3 : 20).map((i) => <Chip key={i.id} item={i} compact />)}
                  {view === "month" && list.length > 3 && <p className="text-[10px] text-muted-foreground">+{list.length - 3}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
