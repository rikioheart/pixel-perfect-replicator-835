import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/LoadingState";
import { ProQrCard } from "@/components/ProQrCard";
import { PRO_STATUS_LABEL, completion, slugify } from "@/lib/pro-card";

export const Route = createFileRoute("/_authenticated/espace-pro/carte")({
  head: () => ({
    meta: [
      { title: "Ma carte professionnelle — La Voix du Chien" },
      { name: "description", content: "Complétez votre carte professionnelle, obtenez votre QR code et votre adresse publique." },
      { property: "og:title", content: "Ma carte professionnelle — La Voix du Chien" },
      { property: "og:description", content: "Carte professionnelle numérique et QR code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProCardPage,
});

type Form = {
  display_name: string;
  slug: string;
  logo_url: string;
  specialties: string;
  sector: string;
  description: string;
  website_url: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  public_email: string;
  public_phone: string;
  public_city: string;
};

const EMPTY: Form = {
  display_name: "", slug: "", logo_url: "", specialties: "", sector: "", description: "",
  website_url: "", instagram: "", facebook: "", linkedin: "", public_email: "", public_phone: "", public_city: "",
};

const STEPS = ["Identité", "Activité", "Présentation & contact"] as const;

function ProCardPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [step, setStep] = useState(0);

  const { data: card, isLoading } = useQuery({
    queryKey: ["my-pro-card", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_public_profile")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (card) {
      const s = (card.social_links ?? {}) as Record<string, string>;
      setForm({
        display_name: card.display_name, slug: card.slug, logo_url: card.logo_url ?? "",
        specialties: card.specialties.join(", "), sector: card.sector ?? "", description: card.description ?? "",
        website_url: card.website_url ?? "", instagram: s["instagram"] ?? "", facebook: s["facebook"] ?? "", linkedin: s["linkedin"] ?? "",
        public_email: card.public_email ?? "", public_phone: card.public_phone ?? "", public_city: card.public_city ?? "",
      });
    } else if (profile) {
      const name = profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ");
      setForm((f) => ({ ...f, display_name: f.display_name || name, slug: f.slug || slugify(name), public_city: f.public_city || (profile.city ?? "") }));
    }
  }, [card, profile]);

  const payload = () => {
    const slug = slugify(form.slug || form.display_name);
    if (form.display_name.trim().length < 2) throw new Error("Indiquez votre nom ou celui de votre structure.");
    if (slug.length < 3) throw new Error("L'adresse courte doit faire au moins 3 caractères.");
    const socials: Record<string, string> = {};
    for (const k of ["instagram", "facebook", "linkedin"] as const) if (form[k].startsWith("http")) socials[k] = form[k].trim();
    return {
      profile_id: user!.id,
      display_name: form.display_name.trim(),
      slug,
      logo_url: form.logo_url.trim() || null,
      specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
      sector: form.sector.trim() || null,
      description: form.description.trim() || null,
      website_url: form.website_url.trim() || null,
      social_links: socials,
      public_email: form.public_email.trim() || null,
      public_phone: form.public_phone.trim() || null,
      public_city: form.public_city.trim() || null,
    };
  };

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const row = { ...payload(), ...(submit ? { status: "PENDING_REVIEW" } : {}) };
      const { error } = card
        ? await supabase.from("professional_public_profile").update(row).eq("id", card.id)
        : await supabase.from("professional_public_profile").insert(row);
      if (error) {
        if (error.code === "23505") throw new Error("Cette adresse courte est déjà prise, choisissez-en une autre.");
        throw error;
      }
      return submit;
    },
    onSuccess: (submit) => {
      toast.success(submit ? "Carte envoyée au Bureau pour validation." : "Carte enregistrée.");
      void queryClient.invalidateQueries({ queryKey: ["my-pro-card"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pct = completion({ display_name: form.display_name, logo_url: form.logo_url, specialties: form.specialties.split(",").filter((s) => s.trim()), sector: form.sector, description: form.description, website_url: form.website_url, public_email: form.public_email, public_phone: form.public_phone });

  const field = (key: keyof Form, label: string, props: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <div>
      <Label htmlFor={`pc-${key}`}>{label}</Label>
      <Input id={`pc-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </div>
  );

  if (isLoading) return <AppShell title="Ma carte professionnelle"><LoadingState rows={4} /></AppShell>;

  const status = card?.status ?? "DRAFT";
  const firstTime = !card;

  return (
    <AppShell
      title="Ma carte professionnelle"
      subtitle="Votre vitrine publique dans le réseau La Voix du Chien"
      actions={card?.status === "ACTIVE" ? (
        <Button asChild size="sm" variant="outline" className="gap-2">
          <Link to="/professionnels/$slug" params={{ slug: card.slug }} target="_blank">
            <ExternalLink className="size-4" aria-hidden /> Voir ma page publique
          </Link>
        </Button>
      ) : null}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="panel space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={status === "ACTIVE" ? "default" : status === "SUSPENDED" ? "destructive" : "secondary"}>
                {PRO_STATUS_LABEL[status]}
              </Badge>
              <span className="text-xs text-muted-foreground">Profil complété à {pct} %</span>
            </div>
            <Progress value={pct} aria-label={`Profil complété à ${pct} %`} />
            {card?.review_comment ? <p className="text-xs text-muted-foreground">Message du Bureau : {card.review_comment}</p> : null}
            {firstTime ? (
              <p className="text-xs text-muted-foreground">
                Pas besoin de tout remplir maintenant : enregistrez un brouillon, vous compléterez plus tard.
              </p>
            ) : null}
          </div>

          <nav aria-label="Étapes" className="flex flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <Button key={s} size="sm" variant={i === step ? "default" : "outline"} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}>
                {i + 1}. {s}
              </Button>
            ))}
          </nav>

          <div className="panel space-y-3 p-5">
            {step === 0 ? (
              <>
                {field("display_name", "Nom affiché (vous ou votre structure)")}
                <div>
                  <Label htmlFor="pc-slug">Adresse courte</Label>
                  <Input id="pc-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} aria-describedby="pc-slug-help" />
                  <p id="pc-slug-help" className="mt-1 text-xs text-muted-foreground">/professionnels/{form.slug || "…"} — jamais d'identifiant interne.</p>
                </div>
                {field("logo_url", "Logo (lien vers l'image)", { placeholder: "https://…" })}
              </>
            ) : step === 1 ? (
              <>
                {field("specialties", "Spécialités (séparées par des virgules)", { placeholder: "Éducation, Comportement" })}
                {field("sector", "Secteur d'intervention", { placeholder: "Nord-Isère" })}
                {field("public_city", "Ville affichée")}
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="pc-desc">Présentation</Label>
                  <Textarea id="pc-desc" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                {field("website_url", "Site internet", { placeholder: "https://…" })}
                <div className="grid gap-3 sm:grid-cols-3">
                  {field("instagram", "Instagram")}
                  {field("facebook", "Facebook")}
                  {field("linkedin", "LinkedIn")}
                </div>
                <p className="text-xs text-muted-foreground">Coordonnées publiques : ne remplissez que ce que vous acceptez de montrer.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("public_email", "E-mail public", { type: "email" })}
                  {field("public_phone", "Téléphone public", { type: "tel" })}
                </div>
              </>
            )}
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Précédent</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending}>Enregistrer</Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={() => setStep(step + 1)}>Suivant</Button>
                ) : status === "DRAFT" ? (
                  <Button className="gap-2" onClick={() => save.mutate(true)} disabled={save.isPending}>
                    <Send className="size-4" aria-hidden /> Envoyer pour validation
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <h2 className="font-display text-lg">Mon QR code</h2>
          {card ? (
            <ProQrCard slug={card.slug} name={card.display_name} published={card.status === "ACTIVE"} />
          ) : (
            <p className="panel p-4 text-sm text-muted-foreground">Enregistrez votre carte pour obtenir votre QR code.</p>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
