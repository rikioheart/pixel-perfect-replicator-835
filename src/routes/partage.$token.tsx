import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedEntity } from "@/lib/shares.functions";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import logoMark from "@/assets/logo-lvdc-mark.png.asset.json";

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

const STATUS_MESSAGE: Record<string, { title: string; message: string }> = {
  missing: {
    title: "Lien introuvable",
    message:
      "Ce lien de partage n'existe pas ou l'élément a été supprimé. Demandez-en un nouveau à l'association.",
  },
  expired: {
    title: "Lien expiré",
    message:
      "La durée de validité de ce lien est dépassée. Demandez un nouveau lien à la personne qui vous l'a transmis.",
  },
  revoked: {
    title: "Lien désactivé",
    message: "L'association a désactivé ce lien. Il n'est plus consultable.",
  },
  forbidden: {
    title: "Consultation impossible",
    message:
      "Cet élément est réservé aux membres du Bureau et ne peut pas être consulté depuis un lien externe.",
  },
};

function SharedPage() {
  const { token } = Route.useParams();
  const fetchShared = useServerFn(getSharedEntity);

  const { data, isPending } = useQuery({
    queryKey: ["shared", token],
    queryFn: () => fetchShared({ data: { token } }),
  });

  const payload = data?.payload ?? null;
  const problem = !isPending && !payload ? (STATUS_MESSAGE[data?.status ?? "missing"] ?? STATUS_MESSAGE["missing"]!) : null;

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#contenu-partage"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <header className="surface-night flex items-center gap-3 px-6 py-4">
        <img src={logoMark.url} alt="Logo La Voix du Chien" className="size-9 rounded-full object-contain" />
        <div className="leading-tight">
          <p className="font-display text-sm">La Voix du Chien</p>
          <p className="text-xs">Partage en lecture seule</p>
        </div>
      </header>

      <main id="contenu-partage" className="mx-auto max-w-2xl p-6">
        {isPending ? (
          <LoadingState label="Chargement du contenu partagé…" rows={4} />
        ) : problem ? (
          <div className="panel p-6">
            <h1 className="text-xl">{problem.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{problem.message}</p>
          </div>
        ) : payload ? (
          <article className="panel space-y-4 p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {TYPE_LABEL[payload.entityType]}
            </p>
            <h1 className="text-2xl">{payload.title}</h1>
            {payload.description ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {payload.description}
              </p>
            ) : null}
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {payload.meta.map((item) => (
                <div key={item.label} className="rounded-md border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            {payload.url ? (
              <Button asChild>
                <a href={payload.url} target="_blank" rel="noreferrer">
                  Ouvrir le document (nouvel onglet)
                </a>
              </Button>
            ) : null}
          </article>
        ) : null}
      </main>
    </div>
  );
}
