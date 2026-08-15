import { Link } from "@tanstack/react-router";
import { Newspaper, CalendarRange, UserPlus } from "lucide-react";
import { useNewsFeed } from "@/lib/home-config";
import { formatDate } from "@/lib/domain";
import { EmptyState } from "@/components/EmptyState";

const ICONS = {
  ARTICLE: Newspaper,
  EVENEMENT: CalendarRange,
  MEMBRE: UserPlus,
} as const;

/** Fil d'actualité commun à tous les tableaux de bord. */
export function NewsFeed() {
  const { data } = useNewsFeed();
  const items = data ?? [];

  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg">Fil d'actualité</h2>
        <Link to="/blog" className="text-xs text-muted-foreground hover:underline">
          Journal interne
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Le fil se remplira vite"
          message="Dès qu'un article est publié, un événement programmé ou un membre accueilli, tout apparaît ici."
        />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <li key={item.id} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.kind === "ARTICLE"
                      ? "Article"
                      : item.kind === "EVENEMENT"
                        ? "Événement"
                        : "Nouveau membre"}
                    {item.subtitle ? ` · ${item.subtitle}` : ""} · {formatDate(item.date)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
