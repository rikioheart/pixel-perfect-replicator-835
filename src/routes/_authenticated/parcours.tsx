import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Flag, Gift, HandHeart, Handshake, ListChecks, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { CONTRIBUTION_STATUS_LABEL } from "@/lib/contributions";

export const Route = createFileRoute("/_authenticated/parcours")({
  head: () => ({
    meta: [
      { title: "Mon parcours avec La Voix du Chien" },
      { name: "description", content: "Votre chemin dans l'association : activités, événements, contributions, rencontres et moments importants." },
      { property: "og:title", content: "Mon parcours avec La Voix du Chien" },
      { property: "og:description", content: "La timeline personnelle du membre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JourneyPage,
});

type Item = { date: string; icon: typeof Flag; title: string; detail?: string };

function JourneyPage() {
  const { user, profile } = useAuth();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["journey", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Item[]> => {
      const uid = user!.id;
      const [parts, contribs, tasks, claims, refs] = await Promise.all([
        supabase.from("participations").select("id,registered_at,registration_status,activities(title),events(title),participation_dogs(dogs(name))").eq("user_id", uid),
        supabase.from("contributions").select("id,title,status,created_at,completed_at").eq("user_id", uid),
        supabase.from("tasks").select("id,title,completed_at,validated_at").eq("assigned_user_id", uid).not("completed_at", "is", null),
        supabase.from("advantage_claims").select("created_at,advantages(title)").eq("user_id", uid),
        supabase.from("dog_referents").select("created_at,professional_id,dogs(name)"),
      ]);
      const out: Item[] = [];
      const reg = (profile as { membership_date?: string | null } | null)?.membership_date;
      if (reg) out.push({ date: reg, icon: Flag, title: "Arrivée dans l'association" });
      for (const p of (parts.data ?? []) as unknown as { registered_at: string; registration_status: string; activities: { title: string } | null; events: { title: string } | null; participation_dogs: { dogs: { name: string } | null }[] }[]) {
        const dogs = p.participation_dogs.map((d) => d.dogs?.name).filter(Boolean) as string[];
        out.push({
          date: p.registered_at,
          icon: CalendarDays,
          title: p.activities ? `Activité : ${p.activities.title}` : `Événement : ${p.events?.title ?? ""}`,
          ...(dogs.length ? { detail: `Vous avez participé avec ${dogs.join(" et ")}` } : {}),
        });
      }
      for (const c of contribs.data ?? []) {
        out.push({ date: c.created_at, icon: HandHeart, title: `Proposition d'aide : ${c.title}`, detail: CONTRIBUTION_STATUS_LABEL[c.status] });
        if (c.completed_at) out.push({ date: c.completed_at, icon: Sparkles, title: `Contribution réalisée : ${c.title}` });
      }
      for (const t of tasks.data ?? []) out.push({ date: t.completed_at!, icon: ListChecks, title: `Action terminée : ${t.title}` });
      for (const a of (claims.data ?? []) as unknown as { created_at: string; advantages: { title: string } | null }[])
        out.push({ date: a.created_at, icon: Gift, title: `Avantage utilisé : ${a.advantages?.title ?? ""}` });
      for (const r of (refs.data ?? []) as unknown as { created_at: string; dogs: { name: string } | null }[])
        out.push({ date: r.created_at, icon: Handshake, title: "Rencontre avec un professionnel référent", ...(r.dogs ? { detail: `Pour ${r.dogs.name}` } : {}) });
      return out.sort((a, b) => b.date.localeCompare(a.date));
    },
  });

  return (
    <AppShell title="Mon parcours avec La Voix du Chien" subtitle="Votre chemin à vous — le carnet de vie de vos chiens reste dans leur dossier">
      {isLoading ? <LoadingState rows={4} /> : items.length === 0 ? (
        <EmptyState title="Votre parcours commence" message="Vos activités, événements et contributions s'afficheront ici au fil du temps." />
      ) : (
        <ol className="relative space-y-4 border-l-2 border-border pl-6">
          {items.map((it, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[33px] flex size-6 items-center justify-center rounded-full surface-wine" aria-hidden>
                <it.icon className="size-3.5" />
              </span>
              <p className="text-xs text-muted-foreground">{new Date(it.date).toLocaleDateString("fr-FR", { dateStyle: "long" })}</p>
              <p className="font-medium">{it.title}</p>
              {it.detail ? <p className="text-sm text-muted-foreground">{it.detail}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}
