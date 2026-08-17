import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { profileCompletion } from "@/lib/home-config";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Bienvenue — compléter mon profil | La Voix du Chien" },
      {
        name: "description",
        content:
          "Parcours guidé en trois étapes pour compléter votre fiche adhérent : identité, ancrage local et visibilité.",
      },
      { property: "og:title", content: "Compléter mon profil — La Voix du Chien" },
      {
        property: "og:description",
        content: "Trois étapes simples pour finaliser votre fiche adhérent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

type FormState = {
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string;
  city: string;
  department: string;
  bio: string;
  public_visibility: boolean;
};

const STEPS = [
  { title: "Qui êtes-vous ?", hint: "Votre identité au sein de l'association." },
  { title: "Où êtes-vous ?", hint: "Votre ancrage local, pour les activités près de chez vous." },
  { title: "Votre présentation", hint: "Quelques mots et votre visibilité dans l'annuaire." },
] as const;

const STEP_FIELDS: Record<number, (keyof FormState)[]> = {
  0: ["first_name", "last_name", "display_name", "phone"],
  1: ["city", "department"],
  2: ["bio"],
};

function OnboardingPage() {
  const { user, profile, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    first_name: "",
    last_name: "",
    display_name: "",
    phone: "",
    city: "",
    department: "",
    bio: "",
    public_visibility: false,
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      display_name: profile.display_name ?? "",
      phone: (profile as { phone?: string | null }).phone ?? "",
      city: profile.city ?? "",
      department: profile.department ?? "",
      bio: profile.bio ?? "",
      public_visibility: profile.public_visibility,
    });
  }, [profile]);

  const { percent, missing } = profileCompletion(profile);

  const liveMissing = useMemo(
    () =>
      (Object.keys(STEP_FIELDS) as unknown as number[])
        .flatMap((key) => STEP_FIELDS[Number(key)])
        .filter((field) => String(form[field] ?? "").trim() === ""),
    [form],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (form.first_name.trim().length < 2) throw new Error("Le prénom est obligatoire.");
      if (form.phone && !/^[0-9+\s.-]{6,20}$/.test(form.phone))
        throw new Error("Numéro de téléphone invalide.");
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          display_name: form.display_name.trim() || null,
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          department: form.department.trim() || null,
          bio: form.bio.trim() || null,
          public_visibility: form.public_visibility,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Étape enregistrée, merci !");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stepPercent = Math.round(((step + 1) / STEPS.length) * 100);

  const goNext = async () => {
    await save.mutateAsync().catch(() => null);
    if (save.isError) return;
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  return (
    <AppShell
      title="Compléter mon profil"
      subtitle={`Bonjour ${profile?.first_name ?? ""}, trois petites étapes suffisent.`}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" /> Étape {step + 1} / {STEPS.length} — {STEPS[step].title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{STEPS[step].hint}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Progress value={stepPercent} />

            {step === 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ob-first">Prénom</Label>
                  <Input
                    id="ob-first"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ob-last">Nom</Label>
                  <Input
                    id="ob-last"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ob-display">Nom affiché</Label>
                  <Input
                    id="ob-display"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ob-phone">Téléphone</Label>
                  <Input
                    id="ob-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ob-city">Commune</Label>
                  <Input
                    id="ob-city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ob-dep">Département</Label>
                  <Input
                    id="ob-dep"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ob-bio">Présentation</Label>
                  <Textarea
                    id="ob-bio"
                    rows={5}
                    placeholder="Votre lien avec les chiens, ce que vous aimeriez apporter à l'association…"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.public_visibility}
                    onChange={(e) => setForm({ ...form, public_visibility: e.target.checked })}
                  />
                  Rendre mon profil visible par les autres membres
                </label>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={step === 0}
                onClick={() => setStep((current) => Math.max(0, current - 1))}
              >
                <ArrowLeft className="size-4" /> Précédent
              </Button>
              {step < STEPS.length - 1 ? (
                <Button size="sm" className="gap-2" disabled={save.isPending} onClick={goNext}>
                  Enregistrer et continuer <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                >
                  <Check className="size-4" /> Terminer
                </Button>
              )}
              <Button asChild size="sm" variant="ghost">
                <Link to="/profile">Ouvrir ma fiche complète</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Complétion du profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-display text-3xl">{percent}%</p>
            <Progress value={percent} />
            {missing.length === 0 ? (
              <p className="text-muted-foreground">Votre fiche est complète, merci beaucoup !</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Champs encore à renseigner — cliquez pour y aller directement :
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { label: "Prénom", field: "first_name", step: 0 },
                      { label: "Nom", field: "last_name", step: 0 },
                      { label: "Nom affiché", field: "display_name", step: 0 },
                      { label: "Téléphone", field: "phone", step: 0 },
                      { label: "Commune", field: "city", step: 1 },
                      { label: "Département", field: "department", step: 1 },
                      { label: "Présentation", field: "bio", step: 2 },
                    ] as { label: string; field: keyof FormState; step: number }[]
                  )
                    .filter((item) => liveMissing.includes(item.field))
                    .map((item) => (
                      <Button
                        key={item.field}
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setStep(item.step);
                          requestAnimationFrame(() => {
                            document
                              .getElementById(
                                `ob-${
                                  item.field === "first_name"
                                    ? "first"
                                    : item.field === "last_name"
                                      ? "last"
                                      : item.field === "display_name"
                                        ? "display"
                                        : item.field === "department"
                                          ? "dep"
                                          : item.field
                                }`,
                              )
                              ?.focus();
                          });
                        }}
                      >
                        {item.label}
                      </Button>
                    ))}
                </div>
              </>
            )}
            <Badge variant="secondary">Chaque petit pas compte</Badge>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
