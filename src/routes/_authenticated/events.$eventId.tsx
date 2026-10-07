import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarRange, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Comments } from "@/components/Comments";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { LoadingState } from "@/components/LoadingState";
import { useState } from "react";
import { RegistrationWizard } from "@/components/RegistrationWizard";
import { ExperienceSections, SpotsBadge, useSpots } from "@/components/ExperienceBits";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Fiche événement — La Voix du Chien" },
      {
        name: "description",
        content: "Détail d'un événement de l'association : dates, lieu, participants et inscription.",
      },
      { property: "og:title", content: "Fiche événement — La Voix du Chien" },
      {
        property: "og:description",
        content: "Dates, lieu et inscriptions pour cet événement de l'association.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventDetailPage,
  errorComponent: ({ error }) => (
    <AppShell title="Événement">
      <p role="alert" className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Erreur inattendue"}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Événement">
      <p className="text-sm text-muted-foreground">Événement introuvable.</p>
    </AppShell>
  ),
});

function formatDate(value: string | null) {
  if (!value) return "à définir";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: participations = [] } = useQuery({
    queryKey: ["event-participations", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participations")
        .select("id,user_id,role,registration_status")
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });

  const mine = participations.find((p) => p.user_id === user?.id);
  const [wizard, setWizard] = useState(false);
  const { data: spots } = useSpots({ eventId });

  const toggle = useMutation({
    mutationFn: async () => {
      if (mine) {
        const { error } = await supabase.from("participations").delete().eq("id", mine.id);
        if (error) throw error;
        return;
      }
      setWizard(true);
    },
    onSuccess: () => {
      if (mine) toast.success("Inscription annulée.");
      void queryClient.invalidateQueries({ queryKey: ["event-participations", eventId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell title="Événement">
        <LoadingState label="Chargement des informations…" rows={4} />
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell title="Événement">
        <p className="text-sm text-muted-foreground">Événement introuvable.</p>
      </AppShell>
    );
  }

  const summary = (event.financial_summary ?? {}) as Record<string, unknown>;

  return (
    <AppShell
      title={event.title}
      subtitle={event.event_type.replace("_", " ")}
      actions={
        <>
          <ShareLinkButton entityType="event" entityId={eventId} defaultLabel={event.title} />
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/events">
              <ArrowLeft className="size-4" /> Retour
            </Link>
          </Button>
        </>
      }
    >
      {event.image_url ? (
        <img
          src={event.image_url}
          alt={`Illustration de l'événement ${event.title}`}
          className="mb-4 h-48 w-full rounded-lg object-cover sm:h-64"
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {event.description ? <p className="text-muted-foreground">{event.description}</p> : null}
            <p className="flex items-center gap-2">
              <CalendarRange className="size-4 text-muted-foreground" /> Du {formatDate(event.start_date)} au{" "}
              {formatDate(event.end_date)}
            </p>
            {event.location ? (
              <p className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" /> {event.location}
              </p>
            ) : null}
            <Badge variant="secondary">{event.status}</Badge>
            <SpotsBadge spots={spots} />
            <div className="pt-2">
              <Button onClick={() => toggle.mutate()} disabled={toggle.isPending}>
                {mine ? "Annuler ma participation" : "Je participe"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> Participants ({participations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {participations.length === 0 ? (
                <p className="text-muted-foreground">Aucun inscrit pour l'instant.</p>
              ) : (
                participations.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.user_id === user?.id ? "Moi" : p.role}</span>
                    <Badge variant="outline">{p.registration_status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {isBureau ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Synthèse financière</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {Object.keys(summary).length === 0 ? (
                  <p className="text-muted-foreground">
                    Aucune donnée financière saisie pour cet événement.
                  </p>
                ) : (
                  Object.entries(summary).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{key}</span>
                      <span>{String(value)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="mt-4"><ExperienceSections item={event} /></div>
      <RegistrationWizard open={wizard} onOpenChange={setWizard} target={{ eventId, title: event.title, dogPolicy: event.dog_policy, maxDogs: event.max_dogs, full: Boolean(spots?.full), waitlist: Boolean(spots?.waitlist) }} />
      <div className="mt-6">
        <Comments
          entityType="event"
          entityId={eventId}
          entityTitle={event.title}
          participants={participations.map((p) => p.user_id)}
          linkUrl={`/events/${eventId}`}
        />
      </div>
    </AppShell>
  );
}
