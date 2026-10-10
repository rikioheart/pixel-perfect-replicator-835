import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { runAiAssist } from "@/lib/ai-assist.functions";

type Action = "SUMMARY" | "REPLY" | "INCONSISTENCIES" | "MINUTES";
const LABEL: Record<Action, string> = {
  SUMMARY: "Résumer", REPLY: "Préparer une réponse", INCONSISTENCIES: "Détecter les incohérences", MINUTES: "Préparer un compte rendu",
};

/** IA intégrée là où elle sert : propose → l'humain relit/modifie → valide (tracé) ou refuse. Aucun envoi automatique. */
export function AiAssist({ type, id, actions = ["SUMMARY", "REPLY", "INCONSISTENCIES"] }:
  { type: "project" | "help_request" | "task" | "form"; id: string; actions?: Action[] }) {
  const run = useServerFn(runAiAssist);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action>("SUMMARY");
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async (a: Action) => {
    setAction(a); setOpen(true); setText(""); setBusy(true);
    try {
      const r = await run({ data: { action: a, type, id } });
      setText(r.text); setProposal(r.text);
    } catch (e) { toast.error((e as Error).message); setOpen(false); }
    finally { setBusy(false); }
  };
  const decide = async (status: "VALIDATED" | "REJECTED") => {
    const { data: u } = await supabase.auth.getUser();
    if (u.user && (action === "REPLY" || action === "MINUTES" || status === "VALIDATED")) {
      await supabase.from("ai_suggestions").insert({
        user_id: u.user.id, action, context_type: type, context_id: id, proposal,
        final_text: status === "VALIDATED" ? text : null, status,
        validated_at: status === "VALIDATED" ? new Date().toISOString() : null,
      });
    }
    if (status === "VALIDATED") { await navigator.clipboard.writeText(text).catch(() => {}); toast.success("Texte validé et copié. Rien n'a été envoyé automatiquement."); }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5"><Sparkles className="size-3.5" />Assistant</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {actions.map((a) => <DropdownMenuItem key={a} className="min-h-11" onSelect={() => void start(a)}>{LABEL[a]}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogTrigger className="hidden" />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{LABEL[action]}</DialogTitle>
          <DialogDescription>Proposition de l'assistant, basée uniquement sur les informations auxquelles vous avez accès. À relire : elle peut contenir des erreurs.</DialogDescription>
        </DialogHeader>
        {busy ? <p role="status" className="text-sm text-muted-foreground">L'assistant prépare une proposition…</p>
          : <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} aria-label="Proposition modifiable" />}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => void decide("REJECTED")} disabled={busy}>Refuser</Button>
          <Button onClick={() => void decide("VALIDATED")} disabled={busy || !text}>Valider et copier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
