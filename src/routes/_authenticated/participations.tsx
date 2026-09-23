import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/participations")({
  head: () => ({
    meta: [
      { title: "Mes participations — La Voix du Chien" },
      {
        name: "description",
        content: "Vos inscriptions aux activités et événements de l'association et votre présence.",
      },
      { property: "og:title", content: "Mes participations — La Voix du Chien" },
      {
        property: "og:description",
        content: "Retrouvez toutes les activités et événements auxquels vous participez.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParticipationsPage,
});

const ROLE_LABELS: Record<string, string> = {
  PARTICIPANT: "Participant",
  VOLUNTEER: "Bénévole",
  ORGANIZER: "Organisateur",
  PROFESSIONAL: "Professionnel",
  INTERVENANT: "Intervenant",
};

function ParticipationsPage() {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-participations", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("participations")
        .select(
          "id, role, registration_status, created_at, activity_id, event_id, activities(title, date, location), events(title, start_date, location)",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      return (data ?? []).map((row) => {
        const activity = row.activities as { title: string; date: string | null; location: string | null } | null;
        const event = row.events as { title: string; start_date: string | null; location: string | null } | null;
        return {
          id: row.id,
          role: row.role,
          status: row.registration_status,
          title: activity?.title ?? event?.title ?? "Inscription",
          date: activity?.date ?? event?.start_date ?? null,
          location: activity?.location ?? event?.location ?? null,
          link: row.event_id ? `/events/${row.event_id}` : "/activities",
        };
      });
    },
  });

  return (
    <AppShell
      title="Mes participations"
      subtitle="Vos inscriptions aux activités et événements, et votre présence enregistrée."
    >
      {isLoading ? (
        <LoadingState label="Chargement des informations…" rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Aucune inscription pour l'instant"
          message="Inscrivez-vous à une balade, un atelier ou un événement pour les retrouver ici."
          action={
            <Link to="/activities" className="text-sm font-semibold text-primary hover:underline">
              Voir les activités
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.link}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
            >
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[item.role] ?? item.role}
                  {item.date ? ` · ${new Date(item.date).toLocaleDateString("fr-FR")}` : ""}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {item.status === "CONFIRMED" ? "Confirmée" : "En attente"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
