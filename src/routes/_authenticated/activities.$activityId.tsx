import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Dog, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { RegistrationWizard } from "@/components/RegistrationWizard";
import { SpotsBadge, useSpots, ExperienceSections } from "@/components/ExperienceBits";
import { DOG_POLICY_LABEL } from "@/lib/pro-card";

export const Route = createFileRoute("/_authenticated/activities/$activityId")({
  head: () => ({
    meta: [
      { title: "Fiche activité — La Voix du Chien" },
      { name: "description", content: "Détails de l'activité, places restantes et inscription du foyer et des chiens." },
      { property: "og:title", content: "Fiche activité — La Voix du Chien" },
      { property: "og:description", content: "Tout savoir avant de venir, et s'inscrire en quelques étapes." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityDetail,
});

function ActivityDetail() {
  const { activityId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: a, isLoading } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: async () => {
      const { data, error } = await supabase.from("activities").select("*").eq("id", activityId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: spots } = useSpots({ activityId });
  const { data: people } = useQuery({
    queryKey: ["activity-people", a?.professional_id, a?.referent_id],
    enabled: Boolean(a),
    queryFn: async () => {
      const [pro, ref] = await Promise.all([
        a!.professional_id ? supabase.from("professional_public_profile").select("display_name,slug,status").eq("profile_id", a!.professional_id).maybeSingle() : Promise.resolve({ data: null }),
        a!.referent_id ? supabase.from("profiles").select("display_name,first_name").eq("id", a!.referent_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { pro: pro.data, ref: ref.data };
    },
  });
  const { data: mine } = useQuery({
    queryKey: ["participations", user?.id, activityId],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase.from("participations").select("id,registration_status").eq("user_id", user!.id).eq("activity_id", activityId).maybeSingle();
      return data;
    },
  });
  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("participations").delete().eq("id", mine!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inscription annulée."); void qc.invalidateQueries({ queryKey: ["participations"] }); void qc.invalidateQueries({ queryKey: ["spots"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <AppShell title="Activité"><LoadingState rows={4} /></AppShell>;
  if (!a) return <AppShell title="Activité"><p className="text-sm text-muted-foreground">Activité introuvable.</p></AppShell>;

  const date = a.date ? new Date(a.date) : null;
  return (
    <AppShell
      title={a.title}
      subtitle={a.type}
      actions={<Button asChild variant="outline" size="sm" className="gap-2"><Link to="/activities"><ArrowLeft className="size-4" aria-hidden /> Retour</Link></Button>}
    >
      {a.image_url ? <img src={a.image_url} alt={`Illustration de ${a.title}`} className="mb-4 h-48 w-full rounded-lg object-cover sm:h-64" /> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="panel space-y-3 p-5 text-sm">
            {a.description ? <p>{a.description}</p> : null}
            <p className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" aria-hidden />
              {date ? `${date.toLocaleDateString("fr-FR", { dateStyle: "full" })} à ${date.toLocaleTimeString("fr-FR", { timeStyle: "short" })}` : "Date à définir"}
            </p>
            {a.location ? <p className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" aria-hidden /> {a.location}</p> : null}
            <p className="flex items-center gap-2"><Dog className="size-4 text-muted-foreground" aria-hidden /> {DOG_POLICY_LABEL[a.dog_policy]}{a.max_dogs ? ` (${a.max_dogs} max.)` : ""}</p>
            <p><span className="font-medium">{Number(a.price_member).toFixed(2)} €</span> adhérent · {Number(a.price_public).toFixed(2)} € public</p>
            {people?.pro ? (
              <p>Professionnel : {people.pro.status === "ACTIVE"
                ? <Link to="/professionnels/$slug" params={{ slug: people.pro.slug }} className="underline">{people.pro.display_name}</Link>
                : people.pro.display_name}</p>
            ) : null}
            {people?.ref ? <p>Référent associatif : {people.ref.display_name ?? people.ref.first_name}</p> : null}
          </div>
          <ExperienceSections item={a} />
        </div>
        <aside className="panel h-fit space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm"><Users className="size-4" aria-hidden /> Places</p>
          <SpotsBadge spots={spots} />
          {mine ? (
            <>
              <Badge>{mine.registration_status === "WAITLIST" ? "Sur liste d'attente" : mine.registration_status === "CONFIRMED" ? "Inscription confirmée" : "En attente de confirmation"}</Badge>
              <Button variant="outline" className="w-full" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Annuler mon inscription</Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => setOpen(true)} disabled={spots?.full && !spots.waitlist}>
              {spots?.full ? (spots.waitlist ? "Rejoindre la liste d'attente" : "Complet") : "Je participe"}
            </Button>
          )}
        </aside>
      </div>
      <RegistrationWizard open={open} onOpenChange={setOpen} target={{ activityId, title: a.title, dogPolicy: a.dog_policy, maxDogs: a.max_dogs, full: Boolean(spots?.full), waitlist: Boolean(spots?.waitlist) }} />
    </AppShell>
  );
}
