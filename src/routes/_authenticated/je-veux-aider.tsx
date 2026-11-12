import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HandHeart, Plus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CONTRIBUTION_STATUS_LABEL,
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABEL,
  TIME_OPTIONS,
} from "@/lib/contributions";
import { explainDbError } from "@/lib/task-lifecycle";
import { fetchMySkills } from "@/lib/profile-details";

export const Route = createFileRoute("/_authenticated/je-veux-aider")({
  head: () => ({
    meta: [
      { title: "Je veux aider — La Voix du Chien" },
      {
        name: "description",
        content:
          "Proposer vos compétences ou du temps sur un projet associatif : le Bureau ou le coordinateur échange avec vous avant tout engagement.",
      },
      { property: "og:title", content: "Je veux aider — La Voix du Chien" },
      {
        property: "og:description",
        content: "Proposer vos compétences ou du temps sur un projet associatif.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WantToHelpPage,
});

const NONE = "__none__";

function WantToHelpPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // --- Compétences du profil ---
  const [skills, setSkills] = useState<string[]>([]);
  const { data: mySkills } = useQuery({
    queryKey: ["my-skills", user?.id],
    enabled: Boolean(user?.id),
    // Compétences lues via profile_details (colonne protégée), même source que le profil.
    queryFn: () => fetchMySkills(user!.id),
  });
  useEffect(() => {
    if (mySkills) setSkills(mySkills);
  }, [mySkills]);

  const saveSkills = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase.from("profiles").update({ skills: next }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compétences enregistrées.");
      void qc.invalidateQueries({ queryKey: ["my-skills", user?.id] });
    },
    onError: (e: Error) => toast.error(explainDbError(e)),
  });

  // --- Proposition d'aide ---
  const [type, setType] = useState("");
  const [projectId, setProjectId] = useState(NONE);
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["help-projects"],
    queryFn: async () =>
      (await supabase.from("projects").select("id,title").is("archived_at", null).order("title")).data ?? [],
  });

  const { data: myOffers = [] } = useQuery({
    queryKey: ["my-contributions", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () =>
      (
        await supabase
          .from("contributions")
          .select("id,title,contribution_type,status,estimated_time,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const send = useMutation({
    mutationFn: async () => {
      const proj = projects.find((p) => p.id === projectId);
      const { error } = await supabase.from("contributions").insert({
        user_id: user!.id,
        project_id: projectId === NONE ? null : projectId,
        contribution_type: type,
        title: `${CONTRIBUTION_TYPE_LABEL[type]}${proj ? ` — ${proj.title}` : ""}`,
        description: message.trim() || null,
        estimated_time: time || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Merci ! Le Bureau a reçu votre proposition et reviendra vers vous.");
      setType("");
      setProjectId(NONE);
      setTime("");
      setMessage("");
      void qc.invalidateQueries({ queryKey: ["my-contributions", user?.id] });
      void qc.invalidateQueries({ queryKey: ["contributions"] });
    },
    onError: (e: Error) => toast.error(explainDbError(e)),
  });

  return (
    <AppShell
      title="Je veux aider"
      subtitle="Proposez vos compétences ou un peu de temps : rien ne vous engage tant qu'on n'en a pas parlé ensemble."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel space-y-3 p-5" aria-labelledby="skills-h">
          <h2 id="skills-h" className="font-display text-lg">Mes compétences et centres d'intérêt</h2>
          <p className="text-sm text-muted-foreground">
            Elles aident le Bureau et les coordinateurs à vous proposer ce qui vous correspond. Dans{" "}
            <Link to="/profile" className="underline underline-offset-2">Mon profil</Link>, vous choisissez si les membres de l'annuaire les voient aussi.
          </p>
          <SkillsEditor
            value={skills}
            disabled={saveSkills.isPending}
            onChange={(next) => {
              setSkills(next);
              saveSkills.mutate(next);
            }}
          />
        </section>

        <section className="panel space-y-4 p-5" aria-labelledby="offer-h">
          <h2 id="offer-h" className="font-display text-lg">Proposer mon aide</h2>
          <div className="space-y-1.5">
            <Label htmlFor="offer-type">Comment aimeriez-vous contribuer ?</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="offer-type">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {CONTRIBUTION_TYPES.map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-project">Sur quel projet ?</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="offer-project">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Peu importe, là où c'est utile</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-time">Combien de temps ?</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger id="offer-time">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-msg">Un petit mot (facultatif)</Label>
            <Textarea
              id="offer-msg"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ce que vous aimeriez faire, vos disponibilités…"
              maxLength={1000}
            />
          </div>
          <Button onClick={() => send.mutate()} disabled={!type || send.isPending}>
            <HandHeart className="size-4" aria-hidden /> Envoyer ma proposition
          </Button>
          <p className="text-xs text-muted-foreground">
            Une intention suffit : le coordinateur du projet ou le Bureau en discute avec vous avant tout engagement.
          </p>
        </section>
      </div>

      <section className="panel mt-4 space-y-3 p-5" aria-labelledby="my-offers-h">
        <h2 id="my-offers-h" className="font-display text-lg">Mes propositions</h2>
        {myOffers.length === 0 ? (
          <EmptyState
            art="playful" title="Aucune proposition pour l'instant"
            message="Vos propositions d'aide apparaîtront ici, avec leur avancement."
          />
        ) : (
          <ul className="space-y-3 text-sm">
            {myOffers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{c.title}</span>
                <span className="flex gap-1">
                  <Badge variant="outline">{CONTRIBUTION_TYPE_LABEL[c.contribution_type]}</Badge>
                  <Badge variant="secondary">{CONTRIBUTION_STATUS_LABEL[c.status] ?? c.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Besoin d'aide vous-même ? <Link to="/help-requests" className="underline">Demander un coup de main</Link>.
        </p>
      </section>
    </AppShell>
  );
}
