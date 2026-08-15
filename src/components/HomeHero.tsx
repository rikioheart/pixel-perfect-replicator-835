import { Sparkles, ExternalLink } from "lucide-react";
import logoAsset from "@/assets/logo-lvdc.png.asset.json";
import { useHomeMedia, useExternalLinks } from "@/lib/home-config";

/**
 * Bandeau d'accueil chaleureux : logo de l'association, photo de couverture
 * choisie par le Bureau, message de bienvenue personnalisé et « À la une ».
 */
export function HomeHero({
  firstName,
  roleLabel,
  message,
}: {
  firstName: string;
  roleLabel: string;
  message: string;
}) {
  const { coverUrl, coverCaption, highlight } = useHomeMedia();
  const links = useExternalLinks();

  return (
    <section className="panel overflow-hidden">
      {coverUrl ? (
        <div className="relative h-40 w-full sm:h-52">
          <img
            src={coverUrl}
            alt={coverCaption ?? "Photo de couverture de l'association"}
            className="size-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-5 p-5">
        <img
          src={logoAsset.url}
          alt="Logo de l'association La Voix du Chien"
          className="size-16 shrink-0 rounded-full bg-card object-contain p-1 ring-1 ring-border sm:size-20"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
          <h2 className="font-display text-2xl">Bonjour {firstName || "à vous"} 👋</h2>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>

      {highlight ? (
        <div className="surface-wine flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
          <Sparkles className="size-4 shrink-0" />
          <span className="font-medium">À la une cette semaine :</span>
          <span className="opacity-90">{highlight.title}</span>
          {highlight.body ? <span className="opacity-70">— {highlight.body}</span> : null}
        </div>
      ) : null}

      {links.length ? (
        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
            >
              <ExternalLink className="size-3.5" />
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
