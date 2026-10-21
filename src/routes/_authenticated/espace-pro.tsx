import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useOnline } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/espace-pro")({
  component: ProLayout,
});

/** Affichage seulement : les données restent protégées par la base. Hors réseau, le statut ne peut pas être vérifié : on laisse l'accès au pass et aux demandes locales. */
function ProLayout() {
  const { isPro, isBureau, rolesReady } = useAuth();
  const online = useOnline();
  if (online && rolesReady && !isPro && !isBureau) {
    return (
      <AppShell title="Espace professionnel" subtitle="Réservé aux professionnels validés par le Bureau">
        <div className="panel max-w-xl space-y-3 p-6 text-sm text-muted-foreground">
          <p>Cet espace est destiné aux professionnels partenaires de l’association.</p>
          <p>Vous êtes professionnel ? Le Bureau peut valider votre statut après vérification.</p>
          <Link to="/member" className="inline-block text-primary underline underline-offset-4">Retour à mon espace</Link>
        </div>
      </AppShell>
    );
  }
  return <Outlet />;
}
