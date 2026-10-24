import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { HeartHandshake, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MEMBERSHIP_TYPE_LABEL } from "@/lib/members";
import { AccountDeletionCard } from "@/components/AccountDeletionCard";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Mon profil — La Voix du Chien" },
      {
        name: "description",
        content:
          "Gérez vos informations personnelles, votre visibilité dans l'annuaire.",
      },
      { property: "og:title", content: "Mon profil — La Voix du Chien" },
      {
        property: "og:description",
        content: "Coordonnées et visibilité de votre compte adhérent.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refresh } = useAuth();
  const [form, setForm] = useState({
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

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connexion requise.");
      if (form.first_name.trim().length < 2) throw new Error("Le prénom est obligatoire.");
      if (form.phone && !/^[0-9+\s.-]{6,20}$/.test(form.phone))
        throw new Error("Numéro de téléphone invalide.");
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          display_name: form.display_name.trim() || null,
          phone: form.phone || null,
          city: form.city || null,
          department: form.department || null,
          bio: form.bio || null,
          public_visibility: form.public_visibility,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profil mis à jour.");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Mon profil" subtitle="Vos coordonnées et votre visibilité dans le réseau">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4" /> Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pr-first">Prénom</Label>
                <Input
                  id="pr-first"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pr-last">Nom</Label>
                <Input
                  id="pr-last"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pr-display">Nom affiché</Label>
                <Input
                  id="pr-display"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pr-phone">Téléphone</Label>
                <Input
                  id="pr-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pr-city">Ville</Label>
                <Input
                  id="pr-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pr-dep">Département</Label>
                <Input
                  id="pr-dep"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pr-bio">Présentation</Label>
              <Textarea
                id="pr-bio"
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
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mon adhésion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{profile?.email}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {MEMBERSHIP_TYPE_LABEL[profile?.membership_type ?? ""] ?? profile?.membership_type}
              </Badge>
              <Badge variant={profile?.membership_status === "ACTIVE" ? "default" : "outline"}>
                {profile?.membership_status === "ACTIVE" ? "Adhésion active" : "En attente de validation"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <h2 className="flex items-center gap-2 text-base"><HeartHandshake className="size-4" aria-hidden /> Mon foyer & mes chiens</h2>
        <Button asChild variant="outline"><Link to="/foyer">Ouvrir les fiches de mes chiens</Link></Button>
      </section>

      <div className="mt-6 max-w-xl">
        <AccountDeletionCard />
      </div>
    </AppShell>
  );
}
