import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Eye, Flag, PawPrint, Share2, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dogAge, buildDogTimeline, INDICATOR_FAMILY_LABEL, type TimelineItem } from "@/lib/dog-timeline";

/** Accueil centré sur le chien. Lectures directes soumises aux règles d'accès de la base. */
export function MyDogHome({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-dog-home", userId],
    queryFn: async () => {
      const { data: dogs, error } = await supabase
        .from("dogs")
        .select("id, name, breed, birth_date, character, needs, photo_url")
        .order("created_at");
      if (error) throw error;
      const ids = (dogs ?? []).map((d) => d.id);
      if (!ids.length) return { dogs: [], indicators: [], timeline: {} as Record<string, TimelineItem[]> };
      const [ind, obs, goals, parts] = await Promise.all([
        supabase.from("dog_indicators").select("dog_id, family, label").in("dog_id", ids),
        supabase.from("dog_observations").select("id, dog_id, body, created_at").in("dog_id", ids).order("created_at", { ascending: false }).limit(30),
        supabase.from("dog_goals").select("id, dog_id, title, status, created_at").in("dog_id", ids),
        supabase
          .from("participation_dogs")
          .select("dog_id, participations(id, registration_status, registered_at, activities(title, date), events(title, start_date))")
          .in("dog_id", ids)
          .limit(60),
      ]);
      const timeline: Record<string, TimelineItem[]> = {};
      for (const id of ids) {
        timeline[id] = buildDogTimeline({
          observations: (obs.data ?? []).filter((o) => o.dog_id === id),
          goals: (goals.data ?? []).filter((g) => g.dog_id === id),
          outings: (parts.data ?? [])
            .filter((p) => p.dog_id === id && p.participations)
            .map((p) => {
              const pa = p.participations as unknown as {
                id: string; registration_status: string; registered_at: string;
                activities: { title: string; date: string | null } | null;
                events: { title: string; start_date: string | null } | null;
              };
              return {
                id: pa.id,
                title: pa.activities?.title ?? pa.events?.title ?? "Sortie",
                date: pa.activities?.date ?? pa.events?.start_date ?? pa.registered_at,
                status: pa.registration_status,
              };
            }),
        });
      }
      return { dogs: dogs ?? [], indicators: ind.data ?? [], timeline };
    },
  });

  if (isLoading) return null;
  const dogs = data?.dogs ?? [];

  if (!dogs.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
          <PawPrint className="size-8 text-primary" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-display text-lg">Accompagnez-vous un chien ?</p>
            <p className="text-sm text-muted-foreground">
              Présentez-le quand vous voulez : son carnet de vie et ses sorties apparaîtront ici. Rien n'est obligatoire.
            </p>
          </div>
          <Button asChild><Link to="/foyer">Présenter mon chien</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dogs.map((dog) => {
        const indicators = (data?.indicators ?? []).filter((i) => i.dog_id === dog.id);
        const items = data?.timeline[dog.id] ?? [];
        const age = dogAge(dog.birth_date);
        return (
          <Card key={dog.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-4 pb-3">
              {dog.photo_url ? (
                <img src={dog.photo_url} alt={`Photo de ${dog.name}`} className="size-20 rounded-full object-cover" />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-full bg-secondary" aria-hidden="true">
                  <PawPrint className="size-9 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <CardTitle className="font-display text-2xl">{dog.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {[dog.breed, age].filter(Boolean).join(" · ") || "Votre compagnon"}
                </p>
                {dog.needs ? <p className="mt-1 text-sm">Besoin du moment : {dog.needs}</p> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {indicators.length ? (
                <ul className="flex flex-wrap gap-2" aria-label="Repères pour bien l'accueillir">
                  {indicators.map((i, k) => (
                    <li key={k}>
                      <Badge variant="outline">{INDICATOR_FAMILY_LABEL[i.family] ?? i.family} · {i.label}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm"><Link to="/activities"><CalendarDays className="mr-1 size-4" />Inscrire {dog.name} à une sortie</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to="/foyer"><Share2 className="mr-1 size-4" />Gérer ses professionnels</Link></Button>
              </div>
              <section aria-label={`Carnet de vie de ${dog.name}`}>
                <h3 className="mb-2 text-sm font-semibold">Carnet de vie</h3>
                {items.length ? (
                  <ol className="space-y-2 border-l-2 border-border pl-4">
                    {items.slice(0, 8).map((it) => {
                      const Icon = it.kind === "OUTING" ? CalendarDays : it.kind === "GOAL" ? Flag : it.kind === "OBSERVATION" ? Eye : Sprout;
                      return (
                        <li key={it.key} className="text-sm">
                          <span className="flex items-center gap-2">
                            <Icon className="size-4 text-primary" aria-hidden="true" />
                            <span className="font-medium">{it.title}</span>
                            {it.upcoming ? <Badge variant="secondary">À venir</Badge> : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(it.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                            {it.detail ? ` · ${it.detail}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Le carnet se remplira avec ses sorties, ses objectifs et les observations partagées avec votre accord.
                  </p>
                )}
              </section>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
