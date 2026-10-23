import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useOnline } from "@/lib/offline";
import { canOpenProSpace } from "@/lib/nav-rules";

export const Route = createFileRoute("/_authenticated/espace-pro")({
  component: ProLayout,
});

/** Affichage seulement : les données restent protégées par la base. Refus par défaut. */
function ProLayout() {
  const { isPro, isBureau, rolesReady } = useAuth();
  const online = useOnline();
  if (!rolesReady) {
    return (
      <AppShell title="Espace professionnel">
        <p role="status" className="text-sm text-muted-foreground">Vérification de votre statut…</p>
      </AppShell>
    );
  }
  if (!canOpenProSpace({ isPro, isBureau, rolesReady })) {
    return (
      <AppShell title="Espace professionnel" subtitle="Réservé aux professionnels validés par le Bureau">
        <div className="panel max-w-xl space-y-3 p-6 text-sm text-muted-foreground">
          {online ? (
            <>
              <p>Cet espace est destiné aux professionnels partenaires de l’association.</p>
              <p>Vous êtes professionnel ? Le Bureau peut valider votre statut après vérification.</p>
            </>
          ) : (
            <p>Sans réseau, votre statut professionnel ne peut pas être vérifié sur ce téléphone. Ouvrez une fois l’espace pro avec du réseau pour l’utiliser ensuite hors ligne.</p>
          )}
          <Link to="/member" className="inline-block text-primary underline underline-offset-4">Retour à mon espace</Link>
        </div>
      </AppShell>
    );
  }
  return <Outlet />;
}
