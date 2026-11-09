import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { BarChart3, Download, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { bilanCsv, periodPresets, statSections, type BureauStats, type StatSection } from "@/lib/statistics";

export const Route = createFileRoute("/_authenticated/statistics")({
  head: () => ({
    meta: [
      { title: "Statistiques stratégiques — La Voix du Chien" },
      { name: "description", content: "Membres, activités, projets, engagement bénévole et Pass Terrain, avec la fiche Bilan de l'exercice pour l'AG." },
      { property: "og:title", content: "Statistiques stratégiques — La Voix du Chien" },
      { property: "og:description", content: "Vue stratégique de la vie associative et bilan exportable pour l'Assemblée générale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatisticsPage,
});

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const frDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { dateStyle: "long" });
const esc = (v: string | number) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function printBilan(sections: StatSection[], stats: BureauStats, from: string, to: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const blocks = sections
    .map((s) => `<h2>${esc(s.title)}</h2><table>${s.rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="n">${esc(v)}</td></tr>`).join("")}</table>`)
    .join("");
  const partners = stats.pass.par_partenaire.length
    ? `<h2>Pass Terrain par partenaire</h2><table><tr><th>Partenaire</th><th class="n">Tampons</th><th class="n">Personnes</th></tr>${stats.pass.par_partenaire
        .map((p) => `<tr><td>${esc(p.name)}</td><td class="n">${p.tampons}</td><td class="n">${p.personnes}</td></tr>`)
        .join("")}</table>`
    : "";
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bilan de l'exercice — La Voix du Chien</title>
<style>body{font-family:Georgia,serif;margin:32px;color:#1f2937}h1{font-size:22px;margin:0}p.sub{margin:4px 0 20px;color:#555}
h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px}
td,th{padding:5px 4px;border-bottom:1px solid #eee;text-align:left}.n{text-align:right;white-space:nowrap}footer{margin-top:28px;font-size:11px;color:#666}</style></head>
<body><h1>Bilan de l'exercice — La Voix du Chien</h1><p class="sub">Du ${esc(frDate(from))} au ${esc(frDate(to))} · document préparé pour l'Assemblée générale</p>
${blocks}${partners}<footer>Chiffres issus de la plateforme à la date d'édition (${esc(new Date().toLocaleDateString("fr-FR"))}). Aucun classement de personnes.</footer>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

function StatisticsPage() {
  const { isBureau } = useAuth();
  const presets = periodPresets();
  const [range, setRange] = useState<{ from: string; to: string }>({ from: presets[0].from, to: presets[0].to });
  const [showCharts, setShowCharts] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["bureau-statistics", range.from, range.to],
    enabled: isBureau && Boolean(range.from && range.to) && range.from <= range.to,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bureau_statistics", { _from: range.from, _to: range.to });
      if (error) throw new Error(error.message);
      return data as unknown as BureauStats;
    },
  });
  const { data: categoryData = [] } = useQuery({
    queryKey: ["stats-projects-by-category"],
    enabled: isBureau && showCharts,
    queryFn: async () => {
      const [p, c] = await Promise.all([
        supabase.from("projects").select("category_id").is("archived_at", null),
        supabase.from("project_categories").select("id, name"),
      ]);
      const names = new Map((c.data ?? []).map((x) => [x.id, x.name]));
      const counts = new Map<string, number>();
      for (const row of p.data ?? []) {
        const label = (row.category_id && names.get(row.category_id)) || "Sans catégorie";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      return [...counts.entries()].map(([category, count]) => ({ category, count }));
    },
  });

  if (!isBureau) {
    return (
      <AppShell title="Statistiques stratégiques" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">Les statistiques de l'association sont consultées par le Bureau.</p>
      </AppShell>
    );
  }

  const sections = data ? statSections(data) : [];
  const downloadCsv = () => {
    if (!data) return;
    const blob = new Blob([`\ufeff${bilanCsv(data, range.from, range.to)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bilan-exercice-${range.from}-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const chart = (data?.series ?? []).map((s) => ({ ...s, label: monthLabel(s.mois) }));

  return (
    <AppShell title="Statistiques stratégiques" subtitle="La vie de l'association par thème, et le bilan de l'exercice pour l'AG">
      <section className="panel mb-4 flex flex-wrap items-end gap-3 p-4" aria-label="Période">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={range.from === p.from && range.to === p.to ? "default" : "outline"}
              aria-pressed={range.from === p.from && range.to === p.to}
              onClick={() => setRange({ from: p.from, to: p.to })}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="st-from" className="text-xs">Du</Label>
            <Input id="st-from" type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label htmlFor="st-to" className="text-xs">Au</Label>
            <Input id="st-to" type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button size="sm" variant="outline" className="gap-2" disabled={!data} onClick={() => data && printBilan(sections, data, range.from, range.to)}>
            <Printer className="size-4" aria-hidden /> Bilan de l'exercice (PDF)
          </Button>
          <Button size="sm" variant="outline" className="gap-2" disabled={!data} onClick={downloadCsv}>
            <Download className="size-4" aria-hidden /> Tableur
          </Button>
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Calcul des statistiques en cours…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((s) => (
              <section key={s.title} className="panel p-4" aria-label={s.title}>
                <h2 className="mb-2 text-base">{s.title}</h2>
                <dl className="divide-y divide-border text-sm">
                  {s.rows.map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3 py-1.5">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-display text-lg font-semibold text-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <section className="panel p-4" aria-label="Pass Terrain par partenaire">
              <h2 className="mb-2 text-base">Pass Terrain par partenaire</h2>
              {data.pass.par_partenaire.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun tampon attribué par un partenaire sur la période.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 font-medium">Partenaire</th>
                      <th className="py-1 text-right font-medium">Tampons</th>
                      <th className="py-1 text-right font-medium">Personnes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.pass.par_partenaire.map((p) => (
                      <tr key={`${p.name}-${p.source}`}>
                        <td className="py-1.5">{p.name}{p.source === "BUREAU" ? <span className="text-xs text-muted-foreground"> · Bureau</span> : null}</td>
                        <td className="py-1.5 text-right">{p.tampons}</td>
                        <td className="py-1.5 text-right">{p.personnes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Classé par nom : un suivi de partenariat, jamais un classement.</p>
            </section>
          </div>

          <div className="mt-6">
            <Button variant="outline" className="gap-2" aria-expanded={showCharts} onClick={() => setShowCharts((v) => !v)}>
              <BarChart3 className="size-4" aria-hidden /> {showCharts ? "Masquer les courbes" : "Afficher les courbes"}
            </Button>
          </div>
          {showCharts ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="panel p-5">
                <h2 className="text-base">Évolution mois par mois</h2>
                <div className="mt-4 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="adherents" name="Inscriptions" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="taches" name="Tâches réalisées" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="participations" name="Participations" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="tampons" name="Tampons" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="panel p-5">
                <h2 className="text-base">Projets par catégorie</h2>
                <div className="mt-4 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Projets" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
