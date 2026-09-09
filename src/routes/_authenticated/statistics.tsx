import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/statistics")({
  head: () => ({
    meta: [
      { title: "Statistiques stratégiques — La Voix du Chien" },
      {
        name: "description",
        content:
          "Évolution du réseau, des projets, des participations et de la fidélité de l'association.",
      },
      { property: "og:title", content: "Statistiques stratégiques — La Voix du Chien" },
      {
        property: "og:description",
        content: "Suivi chiffré de la vie associative : adhérents, projets, activités, fidélité.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatisticsPage,
});

type Period = "month" | "quarter" | "year";

const PERIODS: [Period, string][] = [
  ["month", "12 derniers mois"],
  ["quarter", "8 derniers trimestres"],
  ["year", "5 dernières années"],
];

type Row = { created_at?: string | null; [key: string]: unknown };

function bucketKey(date: Date, period: Period) {
  if (period === "year") return String(date.getFullYear());
  if (period === "quarter") return `T${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function buildBuckets(period: Period) {
  const now = new Date();
  const keys: string[] = [];
  const count = period === "year" ? 5 : period === "quarter" ? 8 : 12;
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    if (period === "year") d.setFullYear(now.getFullYear() - i);
    else if (period === "quarter") d.setMonth(now.getMonth() - i * 3);
    else d.setMonth(now.getMonth() - i);
    const key = bucketKey(d, period);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

function tally(rows: Row[] | null, field: string, period: Period, keys: string[]) {
  const map = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const row of rows ?? []) {
    const raw = row[field] as string | null | undefined;
    if (!raw) continue;
    const key = bucketKey(new Date(raw), period);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function StatisticsPage() {
  const [period, setPeriod] = useState<Period>("month");

  const { data, isLoading } = useQuery({
    queryKey: ["statistics"],
    queryFn: async () => {
      const [profiles, projects, tasks, activities, events, participations, pros, cards, stamps, audit, categories] =
        await Promise.all([
          supabase.from("profiles").select("id, created_at, membership_type, membership_status"),
          supabase.from("projects").select("id, created_at, status, category_id"),
          supabase.from("tasks").select("id, created_at, status, completed_at"),
          supabase.from("activities").select("id, created_at"),
          supabase.from("events").select("id, created_at"),
          supabase.from("participations").select("id, created_at, user_id"),
          supabase.from("pro_details").select("id"),
          supabase.from("loyalty_cards").select("id"),
          supabase.from("loyalty_stamps").select("id, created_at, stamps"),
          supabase.from("audit_logs").select("id"),
          supabase.from("project_categories").select("id, label"),
        ]);
      return {
        profiles: profiles.data ?? [],
        projects: projects.data ?? [],
        tasks: tasks.data ?? [],
        activities: activities.data ?? [],
        events: events.data ?? [],
        participations: participations.data ?? [],
        pros: pros.data ?? [],
        cards: cards.data ?? [],
        stamps: stamps.data ?? [],
        audit: audit.data ?? [],
        categories: categories.data ?? [],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <AppShell title="Statistiques stratégiques" subtitle="Chargement…">
        <p className="text-sm text-muted-foreground">Calcul des statistiques en cours…</p>
      </AppShell>
    );
  }

  const totals: [string, number][] = [
    [
      "Professionnels actifs",
      data.profiles.filter(
        (p) => (p.membership_type ?? "").toUpperCase().includes("PRO") && p.membership_status === "ACTIVE",
      ).length,
    ],
    [
      "Particuliers actifs",
      data.profiles.filter(
        (p) => !(p.membership_type ?? "").toUpperCase().includes("PRO") && p.membership_status === "ACTIVE",
      ).length,
    ],
    ["Adhérents inscrits", data.profiles.length],
    ["Projets", data.projects.length],
    ["Projets terminés", data.projects.filter((p) => p.status === "COMPLETED").length],
    ["Tâches réalisées", data.tasks.filter((t) => t.status === "COMPLETED" || t.completed_at).length],
    ["Activités", data.activities.length],
    ["Événements", data.events.length],
    ["Participations", data.participations.length],
    ["Fiches professionnelles", data.pros.length],
    ["Cartes de fidélité", data.cards.length],
    ["Tampons distribués", data.stamps.reduce((sum, s) => sum + (s.stamps ?? 0), 0)],
    ["Actions tracées", data.audit.length],
    [
      "Bénévoles actifs",
      new Set(data.participations.map((p) => p.user_id).filter(Boolean)).size,
    ],
  ];

  const keys = buildBuckets(period);
  const membres = tally(data.profiles, "created_at", period, keys);
  const taches = tally(
    data.tasks.filter((t) => t.completed_at),
    "completed_at",
    period,
    keys,
  );
  const projets = tally(data.projects, "created_at", period, keys);
  const parts = tally(data.participations, "created_at", period, keys);
  const tampons = tally(data.stamps, "created_at", period, keys);

  const chart = keys.map((label) => ({
    label,
    membres: membres.get(label) ?? 0,
    taches: taches.get(label) ?? 0,
    projets: projets.get(label) ?? 0,
    participations: parts.get(label) ?? 0,
    tampons: tampons.get(label) ?? 0,
  }));

  const categoryLabels = new Map(data.categories.map((c) => [c.id, c.label]));
  const byCategory = new Map<string, number>();
  for (const project of data.projects) {
    const label = (project.category_id && categoryLabels.get(project.category_id)) || "Sans catégorie";
    byCategory.set(label, (byCategory.get(label) ?? 0) + 1);
  }
  const categoryData = [...byCategory.entries()].map(([category, count]) => ({ category, count }));

  return (
    <AppShell
      title="Statistiques stratégiques"
      subtitle="L'évolution du réseau et des actions, en un coup d'œil."
      actions={
        <div className="flex gap-2">
          {PERIODS.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={period === value ? "default" : "outline"}
              onClick={() => setPeriod(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      }
    >
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-primary">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Évolution</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nouveaux adhérents, tâches terminées, projets créés, participations et tampons de fidélité.
        </p>
        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="membres" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="taches" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="projets" stroke="#0f766e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="participations" stroke="#b45309" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tampons" stroke="#4c1d95" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Projets par catégorie</h2>
        <div className="mt-6 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </AppShell>
  );
}
