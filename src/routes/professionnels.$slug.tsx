import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Dog, Gift, Globe, Handshake, Mail, MapPin, Phone } from "lucide-react";
import logoAsset from "@/assets/logo-lvdc.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";

export const Route = createFileRoute("/professionnels/$slug")({
  head: () => ({
    meta: [
      { title: "Carte professionnelle — La Voix du Chien" },
      {
        name: "description",
        content:
          "Carte professionnelle d'un membre du réseau La Voix du Chien : spécialités, activités proposées et avantages adhérents.",
      },
      { property: "og:title", content: "Carte professionnelle — La Voix du Chien" },
      { property: "og:description", content: "Un professionnel du réseau canin La Voix du Chien." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicProCard,
});

type ProPage = {
  slug: string;
  display_name: string;
  logo_url: string | null;
  specialties: string[];
  sector: string | null;
  description: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  public_email: string | null;
  public_phone: string | null;
  public_city: string | null;
  activities: { id: string; title: string; type: string; date: string | null; location: string | null; price_public: number; price_member: number }[];
  advantages: { id: string; title: string; description: string | null; conditions: string | null; valid_until: string | null }[];
  collaborations: { id: string; title: string; description: string | null; happened_on: string | null }[];
  dogs_count: number;
};

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Gift; children: React.ReactNode }) {
  return (
    <section className="panel space-y-3 p-6" aria-labelledby={`s-${title}`}>
      <h2 id={`s-${title}`} className="flex items-center gap-2 font-display text-lg">
        <Icon className="size-4 text-primary" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  );
}

function PublicProCard() {
  const { slug } = Route.useParams();
  const { data: pro, isLoading } = useQuery({
    queryKey: ["public-pro-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_pro_page", { _slug: slug });
      if (error) throw error;
      return (data as unknown as ProPage | null) ?? null;
    },
  });

  const socials = Object.entries(pro?.social_links ?? {}).filter(
    ([, url]) => typeof url === "string" && url.startsWith("http"),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="surface-night">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Logo de La Voix du Chien" className="size-9 rounded-full bg-navy-foreground/10 object-contain p-1" />
            <span className="font-display text-sm">La Voix du Chien</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/association">
              <ArrowLeft className="mr-2 size-4" aria-hidden /> L'association
            </Link>
          </Button>
        </div>
      </header>

      <main id="contenu" className="mx-auto max-w-3xl space-y-5 px-6 py-10">
        {isLoading ? (
          <LoadingState label="Chargement de la carte…" rows={4} />
        ) : !pro ? (
          <div className="panel p-6">
            <h1 className="font-display text-xl">Carte introuvable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce professionnel n'a pas de carte publiée, ou celle-ci a été retirée.
            </p>
          </div>
        ) : (
          <>
            <article className="panel space-y-5 p-6">
              <div className="flex items-start gap-4">
                {pro.logo_url ? (
                  <img src={pro.logo_url} alt={`Logo de ${pro.display_name}`} className="size-20 rounded-lg border border-border object-contain p-1" />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-lg surface-wine font-display text-2xl" aria-hidden>
                    {pro.display_name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-display text-3xl">{pro.display_name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {pro.specialties.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                    {pro.sector || pro.public_city ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden /> {[pro.sector, pro.public_city].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              {pro.description ? <p className="whitespace-pre-line text-sm leading-relaxed">{pro.description}</p> : null}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4 text-xs">
                {pro.website_url ? (
                  <a href={pro.website_url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 hover:bg-accent">
                    <Globe className="size-3.5" aria-hidden /> Site internet
                  </a>
                ) : null}
                {socials.map(([platform, url]) => (
                  <a key={platform} href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-md border border-border px-3 capitalize hover:bg-accent">
                    {platform}
                  </a>
                ))}
                {pro.public_email ? (
                  <a href={`mailto:${pro.public_email}`} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 hover:bg-accent">
                    <Mail className="size-3.5" aria-hidden /> {pro.public_email}
                  </a>
                ) : null}
                {pro.public_phone ? (
                  <a href={`tel:${pro.public_phone}`} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 hover:bg-accent">
                    <Phone className="size-3.5" aria-hidden /> {pro.public_phone}
                  </a>
                ) : null}
              </div>
            </article>

            <Section title="Activités proposées" icon={CalendarDays}>
              {pro.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune activité publique pour le moment.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {pro.activities.map((a) => (
                    <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 last:border-0">
                      <span className="font-medium">{a.title}</span>
                      <span className="text-muted-foreground">
                        {a.date ? new Date(a.date).toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "Date à venir"}
                        {a.location ? ` · ${a.location}` : ""} · {Number(a.price_public).toFixed(2)} €
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Avantages adhérents" icon={Gift}>
              {pro.advantages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun avantage public en cours.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {pro.advantages.map((v) => (
                    <li key={v.id}>
                      <p className="font-medium">{v.title}</p>
                      {v.description ? <p className="text-muted-foreground">{v.description}</p> : null}
                      {v.conditions ? <p className="text-xs text-muted-foreground">Conditions : {v.conditions}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Collaborations avec La Voix du Chien" icon={Handshake}>
              {pro.collaborations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pas encore de collaboration publiée.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {pro.collaborations.map((c) => (
                    <li key={c.id}>
                      <p className="font-medium">{c.title}</p>
                      {c.description ? <p className="text-muted-foreground">{c.description}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Chiens accompagnés" icon={Dog}>
              <p className="text-sm">
                {pro.dogs_count > 0
                  ? `${pro.dogs_count} chien${pro.dogs_count > 1 ? "s" : ""} accompagné${pro.dogs_count > 1 ? "s" : ""} dans le réseau La Voix du Chien.`
                  : "Professionnel du réseau La Voix du Chien."}
              </p>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
