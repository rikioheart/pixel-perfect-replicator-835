import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { HandHeart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { SidePanel } from "@/components/SidePanel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/help-requests")({
  head: () => ({
    meta: [
      { title: "Demandes d'aide — La Voix du Chien" },
      {
        name: "description",
        content:
          "Signaler un blocage ou proposer un coup de main : le Bureau répond et personne ne reste seul.",
      },
      { property: "og:title", content: "Demandes d'aide — La Voix du Chien" },
      {
        property: "og:description",
        content: "Demander de l'aide n'est jamais un échec : c'est ce qui permet d'avancer ensemble.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpRequestsPage,
});

const FILTERS: [string, string][] = [
  ["OPEN", "Ouvertes"],
  ["HANDLED", "Prises en charge"],
  ["RESOLVED", "Résolues"],
  ["", "Toutes"],
];

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Ouverte",
  HANDLED: "Prise en charge",
  RESOLVED: "Résolue",
};

function HelpRequestsPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("OPEN");
  const [askOpen, setAskOpen] = useState(false);
  const [type, setType] = useState("NEEDS_HELP");
  const [message, setMessage] = useState("");
  const [skills, setSkills] = useState("");
  const [answering, setAnswering] = useState<string | null>(null);
  const [response, setResponse] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["help-requests", filter],
    queryFn: async () => {
      let request = supabase
        .from("help_requests")
        .select("id, user_id, type, message, skills, status, response, created_at, profiles:user_id(display_name)")
        .order("created_at", { ascending: false });
      if (filter) request = request.eq("status", filter);
      const { data } = await request;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connexion requise.");
      if (message.trim().length < 5) throw new Error("Décrivez votre besoin en quelques mots.");
      const { data, error } = await supabase
        .from("help_requests")
        .insert({
          user_id: user.id,
          type,
          message: message.trim(),
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        })
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Votre demande est transmise au Bureau.");
      setAskOpen(false);
      setMessage("");
      setSkills("");
      queryClient.invalidateQueries({ queryKey: ["help-requests"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, status, recipient }: { id: string; status: string; recipient: string }) => {
      if (!user) throw new Error("Connexion requise.");
      const { error } = await supabase
        .from("help_requests")
        .update({ status, response: response.trim() || null, handled_by: user.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande mise à jour.");
      setAnswering(null);
      setResponse("");
      queryClient.invalidateQueries({ queryKey: ["help-requests"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current = items.find((item) => item.id === answering);

  return (
    <AppShell
      title={isBureau ? "Aide et propositions" : "Mes demandes d'aide"}
      subtitle="Signaler un blocage n'est jamais un échec : c'est ce qui permet d'avancer ensemble."
      actions={
        <Button className="rounded-full" onClick={() => setAskOpen(true)}>
          <HandHeart className="mr-2 size-4" /> J'ai besoin d'aide
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <Button
            key={label}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Aucune demande"
          message="Utilisez « J'ai besoin d'aide » pour signaler un blocage ou proposer un coup de main."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const author = item.profiles as unknown as { display_name: string | null } | null;
            return (
              <div key={item.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-bold">{author?.display_name ?? "Adhérent"}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type === "NEEDS_HELP" ? "Besoin d'aide" : "Propose son aide"} ·{" "}
                      {new Date(item.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
                <p className="mt-3 text-sm">{item.message}</p>
                {item.skills?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.skills.map((skill: string) => (
                      <span key={skill} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
                {item.response ? (
                  <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs">
                    Réponse du Bureau : {item.response}
                  </p>
                ) : null}
                {isBureau && item.status !== "RESOLVED" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setAnswering(item.id);
                        setResponse(item.response ?? "");
                      }}
                    >
                      Répondre
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() =>
                        update.mutate({ id: item.id, status: "RESOLVED", recipient: item.user_id })
                      }
                    >
                      Marquer résolue
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <SidePanel
        open={askOpen}
        onOpenChange={setAskOpen}
        title="Demander ou proposer de l'aide"
        description="Le Bureau reçoit votre message et vous répond directement ici."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAskOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Envoyer
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label>Type de message</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEEDS_HELP">J'ai besoin d'aide</SelectItem>
              <SelectItem value="OFFER_HELP">Je propose mon aide</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="help-message">Votre message</Label>
          <Textarea
            id="help-message"
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Décrivez le blocage ou ce que vous pouvez apporter."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="help-skills">Compétences concernées (séparées par des virgules)</Label>
          <Input
            id="help-skills"
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
            placeholder="Photo, logistique, comptabilité"
          />
        </div>
      </SidePanel>

      <SidePanel
        open={Boolean(answering)}
        onOpenChange={(open) => !open && setAnswering(null)}
        title="Répondre à la demande"
        description="Votre réponse est envoyée en notification au membre concerné."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAnswering(null)}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                current &&
                update.mutate({ id: current.id, status: "HANDLED", recipient: current.user_id })
              }
              disabled={update.isPending}
            >
              Envoyer la réponse
            </Button>
          </div>
        }
      >
        {current ? <p className="text-sm text-muted-foreground">{current.message}</p> : null}
        <div className="space-y-2">
          <Label htmlFor="help-response">Réponse du Bureau</Label>
          <Textarea
            id="help-response"
            rows={5}
            value={response}
            onChange={(event) => setResponse(event.target.value)}
          />
        </div>
      </SidePanel>
    </AppShell>
  );
}
