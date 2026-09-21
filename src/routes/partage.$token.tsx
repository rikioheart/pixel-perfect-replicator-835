import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedEntity } from "@/lib/shares.functions";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo-lvdc.png.asset.json";

export const Route = createFileRoute("/partage/$token")({
  head: () => ({
    meta: [
      { title: "Partage — La Voix du Chien" },
      {
        name: "description",
        content:
          "Page de consultation partagée par l'association La Voix du Chien : projet, événement ou document en lecture seule.",
      },
      { property: "og:title", content: "Partage — La Voix du Chien" },
      {
        property: "og:description",
        content: "Consultation en lecture seule d'une information partagée par l'association.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedPage,
});

const TYPE_LABEL = {
  project: "Projet",
  event: "Événement",
  document: "Document",
} as const;

function SharedPage() {
  const { token } = Route.useParams();
  const fetchShared = useServerFn(getSharedEntity);

  const { data, isLoading } = useQuery({
    queryKey: ["shared", token],
    queryFn: () => fetchShared({ data: { token } }),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="surface-night flex items-center gap-3 px-6 py-4">
        <img src={logoAsset.url} alt="Logo La Voix du Chien" className="size-9 object-contain" />
        <div className="leading-tight">
          <p className="font-display text-sm">La Voix du Chien</p>
          <p className="text-xs opacity-70">Partage en lecture seule</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !data ? (
          <div className="panel p-6">
            <h1 className="text-xl">Lien indisponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce lien de partage n'existe plus ou a expiré. Demandez-en un nouveau à
              l'association.
            </p>
          </div>
        ) : (
          <article className="panel space-y-4 p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {TYPE_LABEL[data.entityType]}
            </p>
            <h1 className="text-2xl">{data.title}</h1>
            {data.description ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {data.description}
              </p>
            ) : null}
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {data.meta.map((item) => (
                <div key={item.label} className="rounded-md border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            {data.url ? (
              <Button asChild>
                <a href={data.url} target="_blank" rel="noreferrer">
                  Ouvrir le document
                </a>
              </Button>
            ) : null}
          </article>
        )}
      </main>
    </div>
  );
}
