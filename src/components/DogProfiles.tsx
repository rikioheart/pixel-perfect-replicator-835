import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dog, Plus, Trash2, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const emptyDog = { name: "", breed: "", birth_date: "", character: "", needs: "", household_id: "" };
export function DogProfiles({ households, onOpen }: { households: { id: string; name: string }[]; onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dogOpen, setDogOpen] = useState(false);
  const [dog, setDog] = useState(emptyDog);
  const { data: dogs = [], isPending, isError } = useQuery({
    queryKey: ["my-dogs", user?.id], enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("dogs").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = async () => {
    await Promise.all(["my-dogs", "my-dog-home", "my-households", "orphan-dogs"].map(key => qc.invalidateQueries({ queryKey: [key] })));
  };
  const addDog = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connexion requise.");
      if (dog.name.trim().length < 2) throw new Error("Le nom du chien est obligatoire.");
      const { error } = await supabase.from("dogs").insert({ owner_id: user.id, household_id: dog.household_id || null, name: dog.name.trim(), breed: dog.breed || null, birth_date: dog.birth_date || null, character: dog.character || null, needs: dog.needs || null });
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Chien ajouté."); setDogOpen(false); setDog(emptyDog); await refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeDog = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("dogs").delete().eq("id", id); if (error) throw error; },
    onSuccess: async () => { toast.success("Fiche supprimée."); await refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dog className="size-4" /> Fiches de mes chiens
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
                {households.length ? <div><Label htmlFor="dg-household">Foyer</Label><select id="dg-household" className="h-10 w-full rounded-md border border-input bg-background px-2" value={dog.household_id} onChange={e => setDog({ ...dog, household_id: e.target.value })}><option value="">Sans foyer rattaché</option>{households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div> : null}
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
          {isPending ? <p className="text-muted-foreground">Chargement des fiches…</p> : isError ? <p role="alert">Les fiches ne sont pas disponibles pour le moment.</p> : dogs.length === 0 ? (
            <p className="text-muted-foreground">Aucune fiche chien enregistrée.</p>
          ) : (
            dogs.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{item.name}</p>
                  <Button variant="ghost" size="icon" className="size-7" aria-label={`Supprimer la fiche de ${item.name}`} onClick={() => removeDog.mutate(item.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.breed ?? "Race non précisée"}
                  {item.birth_date ? ` · né le ${new Date(item.birth_date).toLocaleDateString("fr-FR")}` : ""}
                </p>
                {item.character ? <p className="mt-1.5">{item.character}</p> : null}
                {item.needs ? <p className="mt-1 text-muted-foreground">Besoins : {item.needs}</p> : null}
                <Button size="sm" variant="outline" className="mt-3" onClick={() => onOpen(item.id)}><FileText className="size-4" aria-hidden /> Ouvrir sa fiche</Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
  );
}
