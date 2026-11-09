import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { BureauConsoleTabs } from "@/components/BureauConsoleTabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunicationCard } from "@/components/CommunicationCard";
import { COMMUNICATION_COLUMNS, CommunicationEditor, type Communication } from "@/components/CommunicationEditor";
import { COMM_CHANNELS, COMM_STATUSES } from "@/lib/project-followup";

export const Route = createFileRoute("/_authenticated/admin/communication")({
  head: () => ({
    meta: [
      { title: "Communication du Bureau — La Voix du Chien" },
      { name: "description", content: "Préparer, valider et publier les communications de l'association et de ses projets." },
      { property: "og:title", content: "Communication du Bureau — La Voix du Chien" },
      { property: "og:description", content: "Espace du Bureau pour valider les communications avant leur publication dans les actualités." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunicationPage,
});

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";

function CommunicationPage() {
  const { isBureau, loading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("IN_REVIEW");
  const [channel, setChannel] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Communication | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["bureau-communications"],
    enabled: isBureau,
    queryFn: async () =>
      ((await supabase.from("bureau_communications").select(COMMUNICATION_COLUMNS).order("target_date", { ascending: true, nullsFirst: false })).data ??
        []) as Communication[],
  });
  const { data: refs } = useQuery({
    queryKey: ["bureau-communications-refs", rows.map((r) => r.id).join(",")],
    enabled: isBureau && rows.length > 0,
    queryFn: async () => {
      const owners = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];
      const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
      const taskIds = [...new Set(rows.map((r) => r.task_id).filter(Boolean))] as string[];
      const [p, pr, t] = await Promise.all([
        owners.length ? supabase.from("profiles").select("id, display_name, first_name, last_name").in("id", owners) : Promise.resolve({ data: [] }),
        projectIds.length ? supabase.from("projects").select("id,title").in("id", projectIds) : Promise.resolve({ data: [] }),
        taskIds.length ? supabase.from("tasks").select("id,title").in("id", taskIds) : Promise.resolve({ data: [] }),
      ]);
      const people = new Map<string, string>();
      for (const x of (p.data ?? []) as { id: string; display_name: string | null; first_name: string | null; last_name: string | null }[]) {
        people.set(x.id, x.display_name || [x.first_name, x.last_name].filter(Boolean).join(" ") || "Membre");
      }
      return {
        people,
        projects: new Map(((pr.data ?? []) as { id: string; title: string }[]).map((x) => [x.id, x.title])),
        tasks: new Map(((t.data ?? []) as { id: string; title: string }[]).map((x) => [x.id, x.title])),
      };
    },
  });

  if (!loading && !isBureau) {
    return (
      <AppShell title="Communication" subtitle="Accès réservé aux membres du Bureau">
        <p className="text-sm text-muted-foreground">Cet espace est réservé au Bureau. Les équipes de projet préparent leurs communications depuis la fiche du projet.</p>
      </AppShell>
    );
  }

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["bureau-communications"] });
    void qc.invalidateQueries({ queryKey: ["project-communications"] });
    void qc.invalidateQueries({ queryKey: ["association-updates"] });
  };
  const shown = rows.filter((r) => r.status === tab && (channel === "ALL" || r.channel === channel));
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <AppShell
      title="Communication"
      subtitle="Valider puis publier dans « Actualités ». Rien n'est diffusé automatiquement ailleurs."
      actions={<Button className="gap-2" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" aria-hidden /> Préparer une communication</Button>}
    >
      <BureauConsoleTabs />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap">
            {COMM_STATUSES.map(([k, l]) => (
              <TabsTrigger key={k} value={k}>{l} ({count(k)})</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="w-56">
          <Label htmlFor="cm-filter" className="text-xs">Canal</Label>
          <select id="cm-filter" className={selectCls} value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="ALL">Tous les canaux</option>
            {COMM_CHANNELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rien dans cette colonne pour l'instant.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((c) => (
            <CommunicationCard
              key={c.id}
              c={c}
              ownerName={c.owner_id ? refs?.people.get(c.owner_id) : undefined}
              projectTitle={c.project_id ? refs?.projects.get(c.project_id) : undefined}
              taskTitle={c.task_id ? refs?.tasks.get(c.task_id) : undefined}
              onEdit={(x) => { setEditing(x); setOpen(true); }}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}

      <CommunicationEditor open={open} onOpenChange={setOpen} editing={editing} onSaved={refresh} />
    </AppShell>
  );
}
