import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dog, Plus, Trash2, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MEMBERSHIP_TYPE_LABEL } from "@/lib/members";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Mon profil — La Voix du Chien" },
      {
        name: "description",
        content:
          "Gérez vos informations personnelles, votre visibilité dans l'annuaire et les fiches de vos chiens.",
      },
      { property: "og:title", content: "Mon profil — La Voix du Chien" },
      {
        property: "og:description",
        content: "Coordonnées, visibilité et fiches chiens de votre compte adhérent.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refresh } = useAuth();
  const queryClient = useQueryClient();
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
  const [dogOpen, setDogOpen] = useState(false);
  const [dog, setDog] = useState({ name: "", breed: "", birth_date: "", character: "", needs: "" });

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

  const { data: dogs = [] } = useQuery({
    queryKey: ["my-dogs", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dogs")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

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
          phone: form.phone || null,
          city: form.city || null,
          department: form.department || null,
          bio: form.bio || null,
          public_visibility: form.public_visibility,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profil mis à jour.");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addDog = useMutation({
    mutationFn: async () => {
      if (dog.name.trim().length < 2) throw new Error("Le nom du chien est obligatoire.");
      const { error } = await supabase.from("dogs").insert({
        owner_id: user!.id,
        name: dog.name.trim(),
        breed: dog.breed || null,
        birth_date: dog.birth_date || null,
        character: dog.character || null,
        needs: dog.needs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chien ajouté.");
      setDogOpen(false);
      setDog({ name: "", breed: "", birth_date: "", character: "", needs: "" });
      void queryClient.invalidateQueries({ queryKey: ["my-dogs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeDog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dogs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche supprimée.");
      void queryClient.invalidateQueries({ queryKey: ["my-dogs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Mon profil" subtitle="Vos informations et vos chiens">
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

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dog className="size-4" /> Mes chiens
          </CardTitle>
          <Dialog open={dogOpen} onOpenChange={setDogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="size-4" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle fiche chien</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="dg-name">Nom</Label>
                  <Input id="dg-name" value={dog.name} onChange={(e) => setDog({ ...dog, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="dg-breed">Race</Label>
                    <Input id="dg-breed" value={dog.breed} onChange={(e) => setDog({ ...dog, breed: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="dg-birth">Naissance</Label>
                    <Input
                      id="dg-birth"
                      type="date"
                      value={dog.birth_date}
                      onChange={(e) => setDog({ ...dog, birth_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="dg-char">Caractère</Label>
                  <Textarea
                    id="dg-char"
                    value={dog.character}
                    onChange={(e) => setDog({ ...dog, character: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dg-needs">Besoins particuliers</Label>
                  <Textarea
                    id="dg-needs"
                    value={dog.needs}
                    onChange={(e) => setDog({ ...dog, needs: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => addDog.mutate()} disabled={addDog.isPending}>
                  Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          {dogs.length === 0 ? (
            <p className="text-muted-foreground">Aucune fiche chien enregistrée.</p>
          ) : (
            dogs.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{item.name}</p>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => removeDog.mutate(item.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.breed ?? "Race non précisée"}
                  {item.birth_date ? ` · né le ${new Date(item.birth_date).toLocaleDateString("fr-FR")}` : ""}
                </p>
                {item.character ? <p className="mt-1.5">{item.character}</p> : null}
                {item.needs ? <p className="mt-1 text-muted-foreground">Besoins : {item.needs}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
