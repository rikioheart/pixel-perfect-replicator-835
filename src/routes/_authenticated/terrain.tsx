import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, MapPin, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/terrain")({
  head: () => ({
    meta: [
      { title: "Terrain et réservations — La Voix du Chien" },
      {
        name: "description",
        content:
          "Gestion du terrain de l'association : ressources disponibles et réservation de créneaux par les professionnels.",
      },
      { property: "og:title", content: "Terrain et réservations — La Voix du Chien" },
      {
        property: "og:description",
        content: "Réservez un créneau sur le terrain de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TerrainPage,
});

function TerrainPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [resourceOpen, setResourceOpen] = useState(false);
  const [resourceName, setResourceName] = useState("");
  const [resourceLocation, setResourceLocation] = useState("");
  const [booking, setBooking] = useState({ resource_id: "", date: "", start_time: "", end_time: "", purpose: "" });

  const { data: resources = [] } = useQuery({
    queryKey: ["terrain-resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("terrain_resources").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["terrain-reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terrain_reservations")
        .select("*, terrain_resources(name)")
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addResource = useMutation({
    mutationFn: async () => {
      if (resourceName.trim().length < 2) throw new Error("Nom de ressource trop court.");
      const { error } = await supabase
        .from("terrain_resources")
        .insert({ name: resourceName.trim(), location: resourceLocation || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ressource ajoutée.");
      setResourceOpen(false);
      setResourceName("");
      setResourceLocation("");
      void queryClient.invalidateQueries({ queryKey: ["terrain-resources"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!booking.resource_id) throw new Error("Choisissez une ressource.");
      if (!booking.date || !booking.start_time || !booking.end_time)
        throw new Error("Date et créneau obligatoires.");
      if (booking.end_time <= booking.start_time)
        throw new Error("L'heure de fin doit être après l'heure de début.");
      const clash = reservations.some(
        (r) =>
          r.resource_id === booking.resource_id &&
          r.date === booking.date &&
          booking.start_time < r.end_time &&
          booking.end_time > r.start_time,
      );
      if (clash) throw new Error("Ce créneau est déjà réservé.");
      const { error } = await supabase.from("terrain_reservations").insert({
        resource_id: booking.resource_id,
        professional_id: user!.id,
        date: booking.date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        purpose: booking.purpose || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réservation enregistrée.");
      setBooking({ resource_id: "", date: "", start_time: "", end_time: "", purpose: "" });
      void queryClient.invalidateQueries({ queryKey: ["terrain-reservations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("terrain_reservations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réservation annulée.");
      void queryClient.invalidateQueries({ queryKey: ["terrain-reservations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Terrain"
      subtitle="Ressources et réservation des créneaux"
      actions={
        isBureau ? (
          <Dialog open={resourceOpen} onOpenChange={setResourceOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" /> Nouvelle ressource
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle ressource</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="tr-name">Nom</Label>
                  <Input id="tr-name" value={resourceName} onChange={(e) => setResourceName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="tr-loc">Emplacement</Label>
                  <Input
                    id="tr-loc"
                    value={resourceLocation}
                    onChange={(e) => setResourceLocation(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => addResource.mutate()} disabled={addResource.isPending}>
                  Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Réserver un créneau</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label htmlFor="bk-res">Ressource</Label>
              <select
                id="bk-res"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={booking.resource_id}
                onChange={(e) => setBooking({ ...booking, resource_id: e.target.value })}
              >
                <option value="">Choisir…</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="bk-date">Date</Label>
              <Input
                id="bk-date"
                type="date"
                value={booking.date}
                onChange={(e) => setBooking({ ...booking, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bk-start">Début</Label>
                <Input
                  id="bk-start"
                  type="time"
                  value={booking.start_time}
                  onChange={(e) => setBooking({ ...booking, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="bk-end">Fin</Label>
                <Input
                  id="bk-end"
                  type="time"
                  value={booking.end_time}
                  onChange={(e) => setBooking({ ...booking, end_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="bk-purpose">Objet</Label>
              <Input
                id="bk-purpose"
                value={booking.purpose}
                onChange={(e) => setBooking({ ...booking, purpose: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={() => book.mutate()} disabled={book.isPending}>
              Réserver
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Créneaux réservés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {reservations.length === 0 ? (
              <p className="text-muted-foreground">Aucune réservation enregistrée.</p>
            ) : (
              reservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {(reservation.terrain_resources as { name: string } | null)?.name ?? "Ressource"}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      {new Date(reservation.date).toLocaleDateString("fr-FR")} ·{" "}
                      {reservation.start_time.slice(0, 5)} – {reservation.end_time.slice(0, 5)}
                      {reservation.purpose ? ` · ${reservation.purpose}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{reservation.status}</Badge>
                    {isBureau || reservation.professional_id === user?.id ? (
                      <Button variant="ghost" size="sm" onClick={() => cancel.mutate(reservation.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ressources du terrain</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          {resources.length === 0 ? (
            <p className="text-muted-foreground">Aucune ressource déclarée.</p>
          ) : (
            resources.map((resource) => (
              <div key={resource.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{resource.name}</p>
                {resource.location ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" /> {resource.location}
                  </p>
                ) : null}
                <Badge variant="secondary" className="mt-2">
                  {resource.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
