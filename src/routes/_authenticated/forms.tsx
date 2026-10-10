import { createFileRoute } from "@tanstack/react-router";
import { AiAssist } from "@/components/AiAssist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/forms")({
  head: () => ({
    meta: [
      { title: "Formulaires — La Voix du Chien" },
      { name: "description", content: "Créer des formulaires reliés aux activités, événements et projets, et traiter les réponses." },
      { property: "og:title", content: "Formulaires — La Voix du Chien" },
      { property: "og:description", content: "Inscriptions, demandes et questionnaires de l'association." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormsPage,
});

type Field = { label: string; required: boolean; long: boolean };
const KINDS = ["INSCRIPTION", "DEMANDE", "RESERVATION", "MATERIEL", "COLLECTE", "PARTICIPATION", "QUESTIONNAIRE"] as const;
const KIND_FR: Record<string, string> = { INSCRIPTION: "Inscription", DEMANDE: "Demande", RESERVATION: "Réservation",
  MATERIEL: "Demande de matériel", COLLECTE: "Collecte d'informations", PARTICIPATION: "Participation", QUESTIONNAIRE: "Questionnaire" };
const EMPTY = { title: "", purpose: "", data_usage: "", contact: "", audience: "INTERNE", kind: "COLLECTE", context: "", fields: "Nom\nMessage*" };

function FormsPage() {
  const { user, isBureau } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: contexts = [] } = useQuery({
    queryKey: ["form-contexts"],
    queryFn: async () => {
      const [a, e, p] = await Promise.all([
        supabase.from("activities").select("id, title").limit(100),
        supabase.from("events").select("id, title").limit(100),
        supabase.from("projects").select("id, title").limit(100),
      ]);
      return [
        ...(a.data ?? []).map((x) => ({ v: `ACTIVITY:${x.id}`, l: `Activité · ${x.title}` })),
        ...(e.data ?? []).map((x) => ({ v: `EVENT:${x.id}`, l: `Événement · ${x.title}` })),
        ...(p.data ?? []).map((x) => ({ v: `PROJECT:${x.id}`, l: `Projet · ${x.title}` })),
      ];
    },
  });
  const { data: responses = [] } = useQuery({
    queryKey: ["form-responses", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data, error } = await supabase.from("form_responses").select("*").eq("form_id", openId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (f.title.trim().length < 3 || f.purpose.trim().length < 5 || f.data_usage.trim().length < 5)
        throw new Error("Titre, objectif et utilisation des données sont obligatoires.");
      const fields: Field[] = f.fields.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20)
        .map((s) => ({ label: s.replace(/\*$/, "").replace(/^\+/, ""), required: s.endsWith("*"), long: s.startsWith("+") }));
      const [ct, cid] = f.context ? f.context.split(":") : [null, null];
      const { error } = await supabase.from("forms").insert({
        title: f.title.trim(), purpose: f.purpose.trim(), data_usage: f.data_usage.trim(), contact: f.contact || null,
        audience: f.audience, kind: f.kind, context_type: ct, context_id: cid, fields: fields as never, created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Formulaire créé (brouillon)."); setF(EMPTY); void qc.invalidateQueries({ queryKey: ["forms"] }); },
    onError: (e: Error) => toast.error(e.message.includes("row-level") ? "Vous n'avez pas le droit de créer ce formulaire." : e.message),
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("forms").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["forms"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const review = useMutation({
    mutationFn: async ({ id, match_status }: { id: string; match_status: string }) => {
      const { error } = await supabase.from("form_responses").update({ match_status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rapprochement enregistré."); void qc.invalidateQueries({ queryKey: ["form-responses"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Formulaires" subtitle="Inscriptions, demandes, matériel, questionnaires — toujours reliés à leur contexte.">
      <section className="mb-8 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold">Nouveau formulaire</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="fm-title">Titre</Label><Input id="fm-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><Label htmlFor="fm-kind">Type</Label>
            <select id="fm-kind" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_FR[k]}</option>)}
            </select></div>
          <div className="sm:col-span-2"><Label htmlFor="fm-purpose">Objectif (affiché)</Label><Textarea id="fm-purpose" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="fm-usage">Utilisation prévue des réponses (affichée)</Label><Textarea id="fm-usage" value={f.data_usage} onChange={(e) => setF({ ...f, data_usage: e.target.value })} /></div>
          <div><Label htmlFor="fm-contact">Contact</Label><Input id="fm-contact" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
          <div><Label htmlFor="fm-aud">Public visé</Label>
            <select id="fm-aud" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              <option value="INTERNE">Membres connectés</option><option value="PUBLIC">Public (lien ouvert)</option>
            </select></div>
          <div className="sm:col-span-2"><Label htmlFor="fm-ctx">Rattaché à</Label>
            <select id="fm-ctx" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })}>
              <option value="">L'association</option>
              {contexts.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select></div>
          <div className="sm:col-span-2"><Label htmlFor="fm-fields">Questions (une par ligne, * = obligatoire, + = réponse longue)</Label>
            <Textarea id="fm-fields" rows={4} value={f.fields} onChange={(e) => setF({ ...f, fields: e.target.value })} /></div>
        </div>
        <Button className="mt-4" onClick={() => create.mutate()} disabled={create.isPending}>Créer</Button>
      </section>

      {isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement…</p> : forms.length === 0 ? (
        <EmptyState title="Aucun formulaire" message="Créez un premier formulaire ci-dessus." />
      ) : (
        <div className="space-y-3">
          {forms.map((fm) => {
            const mine = fm.created_by === user?.id;
            return (
              <article key={fm.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ClipboardList className="size-4 text-primary" aria-hidden />
                  <h3 className="font-semibold">{fm.title}</h3>
                  <span className="text-xs text-muted-foreground">{KIND_FR[fm.kind]} · {fm.audience === "PUBLIC" ? "public" : "membres"} · {fm.status === "PUBLISHED" ? "publié" : fm.status === "CLOSED" ? "clos" : "brouillon"}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{fm.purpose}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(mine || isBureau) && <AiAssist type="form" id={fm.id} actions={["SUMMARY", "INCONSISTENCIES"]} />}
                  {fm.status === "PUBLISHED" && (
                    <>
                      <Button size="sm" asChild><a href={`/formulaire/${fm.id}`}>Répondre</a></Button>
                      <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/formulaire/${fm.id}`); toast.success("Lien copié."); }}>
                        <Copy className="mr-1 size-3.5" />Copier le lien</Button>
                    </>
                  )}
                  {mine && fm.status !== "PUBLISHED" && <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: fm.id, status: "PUBLISHED" })}>Publier</Button>}
                  {mine && fm.status === "PUBLISHED" && <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: fm.id, status: "CLOSED" })}>Clore</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(openId === fm.id ? null : fm.id)}>Réponses</Button>
                </div>
                {openId === fm.id && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {responses.length === 0 ? <p className="text-sm text-muted-foreground">Aucune réponse visible pour vous.</p> : responses.map((r) => (
                      <div key={r.id} className="rounded-lg bg-muted p-3 text-sm">
                        <p className="font-semibold">{r.respondent_name || "Membre connecté"} <span className="text-xs font-normal text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</span></p>
                        <dl className="mt-1 space-y-0.5">
                          {Object.entries((r.answers ?? {}) as Record<string, string>).map(([k, v]) => <div key={k}><dt className="inline font-medium">{k} : </dt><dd className="inline">{v}</dd></div>)}
                        </dl>
                        {r.match_status === "TO_REVIEW" && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs">Une fiche existante semble correspondre (e-mail identique, non suffisant comme preuve).</span>
                            <Button size="sm" variant="outline" onClick={() => review.mutate({ id: r.id, match_status: "CONFIRMED" })}>Confirmer le rapprochement</Button>
                            <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: r.id, match_status: "REJECTED" })}>Personne différente</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
