import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchConfigOptions, type ConfigOption } from "@/lib/config-options";
import type { Profile } from "@/hooks/useAuth";

/**
 * Contenus chaleureux paramétrables par le Bureau, sans redéploiement :
 * - HOME_MEDIA : image de couverture (code = COVER) et « À la une » (code = HIGHLIGHT)
 * - EXTERNAL_LINK : liens Google Drive / Google Form / autres outils
 * L'URL est stockée dans le champ « description » de l'option.
 */
export type HomeLink = { id: string; label: string; url: string; hint: string | null };

function toLink(option: ConfigOption): HomeLink | null {
  const url = (option.description ?? "").trim();
  if (!url.startsWith("http")) return null;
  return { id: option.id, label: option.label, url, hint: option.code };
}

export function useExternalLinks() {
  const { data } = useQuery({
    queryKey: ["config-options", "EXTERNAL_LINK"],
    queryFn: () => fetchConfigOptions("EXTERNAL_LINK"),
    staleTime: 60_000,
  });
  return (data ?? [])
    .filter((option) => option.is_active)
    .map(toLink)
    .filter((link): link is HomeLink => Boolean(link));
}

export function useHomeMedia() {
  const { data } = useQuery({
    queryKey: ["config-options", "HOME_MEDIA"],
    queryFn: () => fetchConfigOptions("HOME_MEDIA"),
    staleTime: 60_000,
  });
  const options = (data ?? []).filter((option) => option.is_active);
  const cover = options.find((option) => option.code.toUpperCase() === "COVER");
  const highlight = options.find((option) => option.code.toUpperCase() === "HIGHLIGHT");
  return {
    coverUrl: (cover?.description ?? "").trim().startsWith("http")
      ? (cover?.description ?? "").trim()
      : null,
    coverCaption: cover?.label ?? null,
    highlight: highlight ? { title: highlight.label, body: highlight.description } : null,
  };
}

const COMPLETION_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: "first_name", label: "Prénom" },
  { key: "last_name", label: "Nom" },
  { key: "display_name", label: "Nom affiché" },
  { key: "email", label: "Email" },
  { key: "city", label: "Commune" },
  { key: "department", label: "Département" },
  { key: "bio", label: "Présentation" },
];

export function profileCompletion(profile: Profile | null) {
  if (!profile) return { percent: 0, missing: COMPLETION_FIELDS.map((f) => f.label) };
  const missing = COMPLETION_FIELDS.filter((field) => {
    const value = profile[field.key];
    return value === null || value === undefined || String(value).trim() === "";
  }).map((field) => field.label);
  const percent = Math.round(
    ((COMPLETION_FIELDS.length - missing.length) / COMPLETION_FIELDS.length) * 100,
  );
  return { percent, missing };
}

export type FeedItem = {
  id: string;
  kind: "ARTICLE" | "EVENEMENT" | "MEMBRE";
  title: string;
  subtitle: string | null;
  date: string | null;
};

/** Fil d'actualité commun : derniers articles, prochains événements, nouveaux membres. */
export function useNewsFeed() {
  return useQuery({
    queryKey: ["home-news-feed"],
    staleTime: 30_000,
    queryFn: async (): Promise<FeedItem[]> => {
      const nowIso = new Date().toISOString();
      const [posts, events, members] = await Promise.all([
        supabase
          .from("blog_posts")
          .select("id, title, excerpt, published_at, status")
          .eq("status", "PUBLISHED")
          .order("published_at", { ascending: false })
          .limit(4),
        supabase
          .from("events")
          .select("id, title, location, start_date")
          .gte("start_date", nowIso)
          .order("start_date", { ascending: true })
          .limit(4),
        supabase
          .from("profiles")
          .select("id, display_name, first_name, membership_type, created_at")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      const items: FeedItem[] = [
        ...(posts.data ?? []).map((post) => ({
          id: `post-${post.id}`,
          kind: "ARTICLE" as const,
          title: post.title,
          subtitle: post.excerpt,
          date: post.published_at,
        })),
        ...(events.data ?? []).map((event) => ({
          id: `event-${event.id}`,
          kind: "EVENEMENT" as const,
          title: event.title,
          subtitle: event.location,
          date: event.start_date,
        })),
        ...(members.data ?? []).map((member) => ({
          id: `member-${member.id}`,
          kind: "MEMBRE" as const,
          title: `${member.display_name ?? member.first_name ?? "Un nouveau membre"} a rejoint l'association`,
          subtitle: member.membership_type,
          date: member.created_at,
        })),
      ];

      return items
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 8);
    },
  });
}

/** Carte de fidélité + palier suivant. */
export function useLoyaltySnapshot(userId: string | undefined) {
  return useQuery({
    queryKey: ["loyalty-snapshot", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      const [card, tiers] = await Promise.all([
        supabase
          .from("loyalty_cards")
          .select("total_stamps")
          .eq("member_id", userId!)
          .maybeSingle(),
        supabase
          .from("loyalty_rules")
          .select("tier_threshold, reward_label")
          .eq("scope", "TIER")
          .eq("is_active", true)
          .order("tier_threshold", { ascending: true }),
      ]);
      const stamps = card.data?.total_stamps ?? 0;
      const nextTier = (tiers.data ?? []).find(
        (tier) => (tier.tier_threshold ?? 0) > stamps,
      );
      return {
        stamps,
        nextThreshold: nextTier?.tier_threshold ?? null,
        nextReward: nextTier?.reward_label ?? null,
      };
    },
  });
}
