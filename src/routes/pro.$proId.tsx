import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/LoadingState";

// Ancienne adresse : redirige vers la carte publique /professionnels/[slug].
export const Route = createFileRoute("/pro/$proId")({
  head: () => ({
    meta: [
      { title: "Fiche professionnel — La Voix du Chien" },
      { name: "description", content: "Redirection vers la carte professionnelle publique." },
      { property: "og:title", content: "Fiche professionnel — La Voix du Chien" },
      { property: "og:description", content: "Carte professionnelle du réseau La Voix du Chien." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LegacyProRedirect,
});

function LegacyProRedirect() {
  const { proId } = Route.useParams();
  const navigate = useNavigate();
  const { data: slug, isLoading } = useQuery({
    queryKey: ["pro-slug", proId],
    queryFn: async () => {
      const { data } = await supabase.rpc("pro_slug_for", { _profile_id: proId });
      return (data as string | null) ?? null;
    },
  });
  useEffect(() => {
    if (slug) void navigate({ to: "/professionnels/$slug", params: { slug }, replace: true });
  }, [slug, navigate]);

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      {isLoading || slug ? (
        <LoadingState label="Ouverture de la carte…" rows={2} />
      ) : (
        <div className="panel p-6">
          <h1 className="font-display text-xl">Fiche introuvable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ce professionnel n'a pas de carte publiée.</p>
          <Link to="/association" className="mt-3 inline-block text-sm underline">Découvrir l'association</Link>
        </div>
      )}
    </main>
  );
}
