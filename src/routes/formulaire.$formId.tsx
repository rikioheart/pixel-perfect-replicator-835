import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { isSafeExternalFormUrl } from "@/lib/form-links";
import { fieldType, validateAnswer, type FormField } from "@/lib/form-fields";

export const Route = createFileRoute("/formulaire/$formId")({
  head: () => ({
    meta: [
      { title: "Formulaire — La Voix du Chien" },
      { name: "description", content: "Répondre à un formulaire de l'association La Voix du Chien." },
      { property: "og:title", content: "Formulaire — La Voix du Chien" },
      { property: "og:description", content: "Objectif, données demandées et utilisation affichés avant de répondre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicForm,
});


function PublicForm() {
  const { formId } = Route.useParams();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");

  const { data: session } = useQuery({ queryKey: ["session-lite"], queryFn: async () => (await supabase.auth.getSession()).data.session });
  const { data: form, isLoading } = useQuery({
    queryKey: ["public-form", formId],
    queryFn: async () => {
      const { data } = await supabase.from("forms").select("id, title, purpose, data_usage, contact, fields, consent_required, audience, external_url").eq("id", formId).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <main className="mx-auto max-w-xl p-6" role="status">Chargement…</main>;
  if (!form) return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="font-display text-2xl font-bold">Formulaire indisponible</h1>
      <p className="mt-2 text-muted-foreground">Ce formulaire est clos, réservé aux professionnels validés par le Bureau, ou n'existe pas.</p>
      <Link to="/" className="mt-4 inline-block underline">Retour à l'accueil</Link>
    </main>
  );
  const fields = (form.fields ?? []) as FormField[];
  const anon = !session;
  if (form.external_url && isSafeExternalFormUrl(form.external_url)) return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <h1 className="font-display text-2xl font-bold">{form.title}</h1>
      <section className="mt-4 space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <p><strong>Objectif :</strong> {form.purpose}</p>
        <p><strong>Utilisation des réponses :</strong> {form.data_usage}</p>
        {form.contact && <p><strong>Contact :</strong> {form.contact}</p>}
        <p className="text-muted-foreground">Ce formulaire est hébergé sur un service externe ({new URL(form.external_url).hostname}). Vos réponses y seront enregistrées, selon ses propres conditions.</p>
      </section>
      <Button asChild className="mt-4"><a href={form.external_url} target="_blank" rel="noopener noreferrer">Ouvrir le formulaire</a></Button>
    </main>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    for (const f of fields) { const m = validateAnswer(f, answers[f.label]); if (m) return setErr(m); }
    setState("sending");
    const { error } = await supabase.rpc("submit_form_response", {
      _form_id: form.id, _answers: answers, _name: anon ? name : "", _email: anon ? email : "", _consent: consent,
    });
    if (error) { setErr(error.message); setState("idle"); } else setState("done");
  };

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <h1 className="font-display text-2xl font-bold">{form.title}</h1>
      <section className="mt-4 space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <p><strong>Objectif :</strong> {form.purpose}</p>
        <p><strong>Informations demandées :</strong> {fields.map((f) => f.label).join(", ")}{anon ? ", nom, e-mail" : ""}.</p>
        <p><strong>Utilisation :</strong> {form.data_usage}</p>
        <p>Vos réponses ne sont jamais publiées ; seules les personnes responsables du formulaire les lisent.</p>
        {form.contact && <p><strong>Contact :</strong> {form.contact}</p>}
      </section>
      {state === "done" ? (
        <section className="mt-6 space-y-3 rounded-xl bg-muted p-5" role="status">
          <h2 className="font-display text-lg font-bold">Merci, votre réponse a bien été transmise.</h2>
          <p className="text-sm">Les personnes responsables du formulaire la liront avec attention. Pour toute correction, utilisez le contact indiqué ci-dessus.</p>
          <Button asChild variant="outline"><Link to={anon ? "/" : "/forms"}>{anon ? "Retour à l'accueil" : "Retour aux formulaires"}</Link></Button>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {anon && (
            <>
              <div><Label htmlFor="pf-name">Votre nom</Label><Input id="pf-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label htmlFor="pf-email">Votre e-mail</Label><Input id="pf-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </>
          )}
          {fields.map((f, i) => (
            <div key={i}>
              <Label htmlFor={`pf-${i}`}>{f.label}{f.required ? " *" : ""}</Label>
              <FieldInput id={`pf-${i}`} field={f} value={answers[f.label] ?? ""} onChange={(v) => setAnswers({ ...answers, [f.label]: v })} />
            </div>
          ))}
          {form.consent_required && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 size-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              J'accepte que ces informations soient utilisées pour l'objectif indiqué ci-dessus.
            </label>
          )}
          {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={state === "sending"}>Envoyer</Button>
        </form>
      )}
    </main>
  );
}

function FieldInput({ id, field, value, onChange }: { id: string; field: FormField; value: string; onChange: (v: string) => void }) {
  const t = fieldType(field);
  const opts = t === "yesno" ? ["Oui", "Non"] : field.options ?? [];
  if (t === "long") return <Textarea id={id} maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)} />;
  if (t === "single" || t === "yesno") return (
    <div role="radiogroup" aria-labelledby={id} id={id} className="mt-1 flex flex-wrap gap-3">
      {opts.map((o) => <label key={o} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" className="size-4" name={id} checked={value === o} onChange={() => onChange(o)} />{o}</label>)}
    </div>
  );
  if (t === "multiple") {
    const picked = value ? value.split(" ; ") : [];
    return (
      <div id={id} className="mt-1 flex flex-wrap gap-3">
        {opts.map((o) => <label key={o} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={picked.includes(o)} onChange={(e) => onChange((e.target.checked ? [...picked, o] : picked.filter((x) => x !== o)).join(" ; "))} />{o}</label>)}
      </div>
    );
  }
  const type = t === "date" ? "date" : t === "email" ? "email" : t === "number" ? "number" : "text";
  return <Input id={id} type={type} inputMode={t === "number" ? "decimal" : undefined} maxLength={300} value={value} onChange={(e) => onChange(e.target.value)} />;
}
