import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { SidePanel } from "@/components/SidePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/domain";
import { explainDbError } from "@/lib/task-lifecycle";
import { COMM_AUDIENCES, COMM_CHANNELS, COMM_STATUSES, canRelayToWall } from "@/lib/project-followup";

export const Route = createFileRoute("/_authenticated/admin/communication")({
  head: () => ({
    meta: [
      { title: "Communication du Bureau — La Voix du Chien" },
      { name: "description", content: "Préparer, relire et organiser les annonces de l'association avant diffusion manuelle." },
      { property: "og:title", content: "Communication du Bureau — La Voix du Chien" },
      { property: "og:description", content: "Espace interne du Bureau pour préparer les communications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunicationPage,
});

type Comm = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  channel: string;
  target_audience: string;
  target_date: string | null;
  project_id: string | null;
  internal_notes: string | null;
};

const EMPTY = { title: "", body: "", status: "DRAFT", channel: "INTERNAL_WALL", target_audience: "ALL_MEMBERS", target_date: "", project_id: "", internal_notes: "" };
const label = (list: [string, string][], k: string) => list.find(([v]) => v === k)?.[1] ?? k;
const selectCls = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";

function CommunicationPage() {
  const { user, isBureau, loading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("DRAFT");
  const [channel, setChannel] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Comm | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: rows = [] } = useQuery({
    queryKey: ["bureau-communications"],
    enabled: isBureau,
    queryFn: async () =>
      ((await supabase.from("bureau_communications").select("*").order("target_date", { ascending: true, nullsFirst: false })).data ?? []) as Comm[],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-lite"],
    enabled: isBureau,
    queryFn: async () => (await supabase.from("projects").select("id,title").order("title")).data ?? [],
  });

  if (!loading && !isBureau) {
    return (
      <AppShell title="Communication" subtitle="Accès réservé aux membres du Bureau">
        <p className="text-sm text-muted-foreground">Cet espace est réservé au Bureau.</p>
      </AppShell>
    );
  }

  const openPanel = (c: Comm | null) => {
    setEditing(c);
    setForm(c ? { title: c.title, body: c.body ?? "", status: c.status, channel: c.channel, target_audience: c.target_audience, target_date: c.target_date ?? "", project_id: c.project_id ?? "", internal_notes: c.internal_notes ?? "" } : EMPTY);
    setOpen(true);
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ["bureau-communications"] });

  const save = async () => {
    if (form.title.trim().length < 2) { toast.error("Donnez un titre."); return; }
    const payload = {
      title: form.title.trim(), body: form.body.trim() || null, status: form.status, channel: form.channel,
      target_audience: form.target_audience, target_date: form.target_date || null, project_id: form.project_id || null,
      internal_notes: form.internal_notes.trim() || null, updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("bureau_communications").update(payload).eq("id", editing.id)
      : await supabase.from("bureau_communications").insert({ ...payload, created_by: user?.id ?? null });
    if (error) { toast.error(explainDbError(error)); return; }
    toast.success("Communication enregistrée.");
    setOpen(false);
    void refresh();
  };

  const copy = async (c: Comm) => {
    await navigator.clipboard.writeText(`${c.title}\n\n${c.body ?? ""}`.trim());
    toast.success("Texte copié : collez-le dans l'outil de diffusion.");
  };

  const relay = async (c: Comm) => {
    const { error } = await supabase.from("association_updates").insert({
      kind: c.project_id ? "PROJET" : "ACTION", title: c.title, body: c.body, project_id: c.project_id, is_public: false, created_by: user!.id,
    });
    if (error) { toast.error(explainDbError(error)); return; }
    await supabase.from("bureau_communications").update({ status: "ARCHIVED", updated_at: new Date().toISOString() }).eq("id", c.id);
    toast.success("Relayée dans « Nos avancées » et classée comme diffusée.");
    void refresh();
    void qc.invalidateQueries({ queryKey: ["association-updates"] });
  };

  const shown = rows.filter((r) => r.status === tab && (channel === "ALL" || r.channel === channel));
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <AppShell
      title="Communication"
      subtitle="Préparer et relire les annonces. Rien n'est publié automatiquement."
      actions={<Button className="gap-2" onClick={() => openPanel(null)}><Plus className="size-4" aria-hidden /> Préparer une communication</Button>}
    >
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
            <li key={c.id} className="panel space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{label(COMM_CHANNELS, c.channel)}</Badge>
                <Badge variant="outline">{label(COMM_AUDIENCES, c.target_audience)}</Badge>
                {c.target_date ? <span className="text-xs text-muted-foreground">Prévue le {formatDate(c.target_date)}</span> : null}
              </div>
              <p className="font-medium">{c.title}</p>
              {c.body ? <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">{c.body}</p> : null}
              {c.project_id ? <p className="text-xs text-muted-foreground">Projet : {projects.find((p) => p.id === c.project_id)?.title ?? "—"}</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openPanel(c)}>Modifier</Button>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => void copy(c)}><Copy className="size-4" aria-hidden /> Copier le texte</Button>
                {canRelayToWall(c) ? (
                  <Button size="sm" className="gap-1" onClick={() => void relay(c)}><Send className="size-4" aria-hidden /> Relayer dans Nos avancées</Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SidePanel open={open} onOpenChange={setOpen} title={editing ? "Modifier la communication" : "Préparer une communication"}>
        <div className="space-y-3">
          <div><Label htmlFor="cm-t">Titre</Label><Input id="cm-t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label htmlFor="cm-b">Texte</Label><Textarea id="cm-b" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cm-s">Étape</Label>
              <select id="cm-s" className={selectCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {COMM_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="cm-c">Canal prévu</Label>
              <select id="cm-c" className={selectCls} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                {COMM_CHANNELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="cm-a">Public visé</Label>
              <select id="cm-a" className={selectCls} value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}>
                {COMM_AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div><Label htmlFor="cm-d">Date prévue (facultatif)</Label><Input id="cm-d" type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></div>
          </div>
          <div>
            <Label htmlFor="cm-p">Projet relié (facultatif)</Label>
            <select id="cm-p" className={selectCls} value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">Aucun</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div><Label htmlFor="cm-n">Notes internes du Bureau</Label><Textarea id="cm-n" rows={3} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">La diffusion reste manuelle : copiez le texte vers l'outil choisi, ou relayez-le dans « Nos avancées » quand il est prêt.</p>
          <Button className="w-full" onClick={save}>Enregistrer</Button>
        </div>
      </SidePanel>
    </AppShell>
  );
}
