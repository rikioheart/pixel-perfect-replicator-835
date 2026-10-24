import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { needsAccountChoice } from "@/lib/account-choice";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const mustChoose = needsAccountChoice(profile);

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: "/" });
    }
  }, [session, loading, navigate]);

  // Compte clôturé : aucune session conservée.
  useEffect(() => {
    if (profile?.deleted_at) void signOut();
  }, [profile?.deleted_at, signOut]);

  // Première connexion (Google ou e-mail) : choisir le parcours avant tout.
  useEffect(() => {
    if (mustChoose && pathname !== "/onboarding") void navigate({ to: "/onboarding" });
  }, [mustChoose, pathname, navigate]);

  if (loading || !session || (mustChoose && pathname !== "/onboarding")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement de votre espace…</p>
      </div>
    );
  }

  return <Outlet />;
}
