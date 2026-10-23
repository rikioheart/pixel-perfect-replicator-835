import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/domain";

const KINDS = [
  { code: "AG", label: "Assemblée générale" },
  { code: "BUREAU", label: "Réunion du Bureau" },
  { code: "REUNION", label: "Réunion de groupe" },
  { code: "AUTRE", label: "Autre" },
] as const;
const kindLabel = (c: string) => KINDS.find((k) => k.code === c)?.label ?? c;
const EMPTY = { kind: "BUREAU", title: "", meeting_date: new Date().toISOString().slice(0, 10), summary: "", decisions: "", follow_up: "" };

/** Registre des comptes rendus et décisions (AG, Bureau, réunions) — réservé au Bureau par la base. */
export function GovernanceRegister() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState("ALL");

  const { data = [], isLoading } = useQuery({
    queryKey: ["governance-records"],
    queryFn: async () => {
      const { data, error } = await supabase.from("governance_records").select("*").order("meeting_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 2) throw new Error("Donnez un titre à la réunion.");
      const payload = { kind: form.kind, title: form.title.trim(), meeting_date: form.meeting_date, summary: form.summary || null, decisions: form.decisions || null, follow_up: form.follow_up || null };
      const { error } = editId
        ? await supabase.from("governance_records").update(payload).eq("id", editId)
        : await supabase.from("governance_records").insert({ ...payload, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Compte rendu mis à jour." : "Compte rendu enregistré.");
      setOpen(false); setEditId(null); setForm(EMPTY);
      void qc.invalidateQueries({ queryKey: ["governance-records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = data.filter((r) => filter === "ALL" || r.kind === filter);

  return (
    <section aria-labelledby="register-title" className="mt-8 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="register-title" className="font-display text-lg">Registre des réunions et décisions</h2>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditId(null); setOpen((o) => !o); }}>{open ? "Fermer" : "Nouveau compte rendu"}</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {[{ code: "ALL", label: "Tout" }, ...KINDS].map((k) => (
          <Button key={k.code} size="sm" variant={filter === k.code ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setFilter(k.code)}>{k.label}</Button>
        ))}
      </div>

      {open ? (
        <form className="panel grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1"><Label htmlFor="gr-kind">Type</Label>
            <select id="gr-kind" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {KINDS.map((k) => <option key={k.code} value={k.code}>{k.label}</option>)}
            </select></div>
          <div className="space-y-1"><Label htmlFor="gr-date">Date</Label><Input id="gr-date" type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="gr-title">Titre</Label><Input id="gr-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="AG annuelle 2026" /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="gr-sum">Compte rendu</Label><Textarea id="gr-sum" rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="gr-dec">Décisions prises</Label><Textarea id="gr-dec" rows={3} value={form.decisions} onChange={(e) => setForm({ ...form, decisions: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="gr-fu">Suivi / retours attendus</Label><Textarea id="gr-fu" rows={3} value={form.follow_up} onChange={(e) => setForm({ ...form, follow_up: e.target.value })} /></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={save.isPending}>Enregistrer</Button></div>
        </form>
      ) : null}

      {isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement…</p> : list.length === 0 ? (
        <p className="panel p-4 text-sm text-muted-foreground">Aucun compte rendu pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <details key={r.id} className="panel p-3 text-sm">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <Badge variant="outline">{kindLabel(r.kind)}</Badge>
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">· {formatDate(r.meeting_date)}</span>
              </summary>
              <div className="mt-2 space-y-2 whitespace-pre-wrap">
                {r.summary ? <p>{r.summary}</p> : null}
                {r.decisions ? <p><span className="font-medium">Décisions : </span>{r.decisions}</p> : null}
                {r.follow_up ? <p><span className="font-medium">Suivi : </span>{r.follow_up}</p> : null}
                <Button size="sm" variant="outline" onClick={() => { setEditId(r.id); setForm({ kind: r.kind, title: r.title, meeting_date: r.meeting_date, summary: r.summary ?? "", decisions: r.decisions ?? "", follow_up: r.follow_up ?? "" }); setOpen(true); }}>Modifier</Button>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
