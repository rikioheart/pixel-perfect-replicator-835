import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";
import { CONTRIBUTION_TYPES, CONTRIBUTION_TYPE_LABEL, TIME_OPTIONS } from "@/lib/contributions";

const STEPS = ["Comment ?", "Quel projet ?", "Combien de temps ?", "Message"];

/** Parcours « Je veux aider » : Comment → Projet → Temps → Message → Envoyer. */
export function HelpWizard({ open, onOpenChange, projectId, presetType }: { open: boolean; onOpenChange: (o: boolean) => void; projectId?: string; presetType?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [type, setType] = useState("");
  const [project, setProject] = useState<string>("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false); setMessage(""); setTime("");
    setType(presetType ?? ""); setProject(projectId ?? "");
    setStep(presetType ? (projectId ? 2 : 1) : 0);
  }, [open, presetType, projectId]);

  const { data: projects = [] } = useQuery({
    queryKey: ["help-projects"],
    enabled: open,
    queryFn: async () => (await supabase.from("projects").select("id,title").is("archived_at", null).order("title")).data ?? [],
  });

  const send = useMutation({
    mutationFn: async () => {
      const proj = projects.find((p) => p.id === project);
      const { error } = await supabase.from("contributions").insert({
        user_id: user!.id,
        project_id: project || null,
        contribution_type: type,
        title: `${CONTRIBUTION_TYPE_LABEL[type]}${proj ? ` — ${proj.title}` : ""}`,
        description: message.trim() || null,
        estimated_time: time || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setDone(true); void qc.invalidateQueries({ queryKey: ["contributions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const choice = (active: boolean, onClick: () => void, label: string, key: string) => (
    <button key={key} type="button" onClick={onClick} aria-pressed={active}
      className={`flex min-h-11 w-full items-center rounded-md border px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-accent" : "border-border"}`}>
      {label}
    </button>
  );

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title="Je veux aider" description={done ? "" : `Étape ${step + 1} sur ${STEPS.length} : ${STEPS[step]}`}>
      {done ? (
        <div className="space-y-3 text-sm" role="status">
          <CheckCircle2 className="size-10 text-primary" aria-hidden />
          <p className="font-display text-lg">Merci !</p>
          <p className="text-muted-foreground">Le Bureau a reçu votre proposition et reviendra vers vous. Rien ne vous engage tant que vous n'avez pas échangé ensemble.</p>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {step === 0 ? CONTRIBUTION_TYPES.map(([k, l]) => choice(type === k, () => setType(k), l, k))
            : step === 1 ? [choice(project === "", () => setProject(""), "Peu importe, là où c'est utile", "none"), ...projects.map((p) => choice(project === p.id, () => setProject(p.id), p.title, p.id))]
            : step === 2 ? TIME_OPTIONS.map((t) => choice(time === t, () => setTime(t), t, t))
            : (
              <div>
                <Label htmlFor="hw-msg">Un petit mot (facultatif)</Label>
                <Textarea id="hw-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ce que vous aimeriez faire, vos disponibilités…" />
              </div>
            )}
          <div className="flex justify-between gap-2 pt-3">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Précédent</Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={step === 0 && !type} onClick={() => setStep(step + 1)}>Suivant</Button>
            ) : (
              <Button onClick={() => send.mutate()} disabled={send.isPending || !type}>Envoyer</Button>
            )}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
